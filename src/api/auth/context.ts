import { ORPCError, os } from "@orpc/server";
import type { Selectable } from "kysely";
import { db } from "@/api/db/connection";
import type { users } from "../db/connection";
import {
	issueSessionCookie,
	readSessionTokens,
	shouldRenewSession,
	verifySessionToken,
} from "./session";

export type User = Selectable<users>;

interface Context {
	reqHeaders?: Headers;
	resHeaders?: Headers;
	user?: User | null;
}

export async function resolveSession(cookieHeader: string | null | undefined) {
	for (const token of readSessionTokens(cookieHeader)) {
		const claims = await verifySessionToken(token);

		if (!claims) {
			continue;
		}

		const user = await db
			.selectFrom("users")
			.where("id", "=", claims.userId)
			.selectAll()
			.executeTakeFirst();

		if (user && (user.session_epoch ?? 0) === claims.sessionEpoch) {
			return { user, claims };
		}
	}

	return null;
}

const base = os.$context<Context>();

const authMiddleware = base.middleware(async ({ context, next }) => {
	if (context.user !== undefined) {
		return next({ context: { user: context.user } });
	}

	const session = await resolveSession(context.reqHeaders?.get("cookie"));

	if (session && shouldRenewSession(session.claims)) {
		await issueSessionCookie({
			userId: session.user.id,
			sessionEpoch: session.user.session_epoch ?? 0,
			resHeaders: context.resHeaders,
			reqHeaders: context.reqHeaders,
		});
	}

	return next({ context: { user: session?.user ?? null } });
});

export const publicProcedure = base.use(authMiddleware);

export const protectedProcedure = publicProcedure.use(({ context, next }) => {
	if (!context.user) {
		throw new ORPCError("UNAUTHORIZED");
	}

	return next({ context: { user: context.user } });
});
