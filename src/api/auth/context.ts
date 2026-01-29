import { os, ORPCError } from "@orpc/server";
import { getCookie } from "@orpc/server/helpers";
import type { Selectable } from "kysely";

import { JWT } from "./jwt";
import { db } from "@/api/db/connection";
import type { users } from "../db/connection";

export type User = Selectable<users>;

interface Context {
	reqHeaders?: Headers;
	resHeaders?: Headers;
	user?: User | null;
}

export async function getUser(token: string | undefined) {
	if (!token) {
		return null;
	}

	const payload = await JWT.verify(token);

	if (!payload) {
		return null;
	}

	return db.selectFrom("users").where("id", "=", payload.userId).selectAll().executeTakeFirst();
}

const base = os.$context<Context>();

const authMiddleware = base.middleware(async ({ context, next }) => {
	if (context.user !== undefined) {
		return next({ context: { user: context.user } });
	}

	const token = context.reqHeaders ? getCookie(context.reqHeaders, "session") : undefined;
	const user = await getUser(token);

	return next({ context: { user } });
});

export const publicProcedure = base.use(authMiddleware);

export const protectedProcedure = publicProcedure.use(({ context, next }) => {
	if (!context.user) {
		throw new ORPCError("UNAUTHORIZED");
	}

	return next({ context: { user: context.user } });
});
