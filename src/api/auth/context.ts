import { ORPCError, os } from "@orpc/server";
import type { Selectable } from "kysely";
import { db } from "@/api/db/connection";
import type { devices, users } from "../db/connection";
import { DEVICE_NOT_APPROVED, isLocalRequest, resolveApprovedDevice } from "./device";
import {
	issueSessionCookie,
	readSessionTokens,
	shouldRenewSession,
	verifySessionToken,
} from "./session";

export type User = Selectable<users>;
export type Device = Selectable<devices>;

interface Context {
	reqHeaders?: Headers;
	resHeaders?: Headers;
	remoteAddress?: string | null;
	user?: User | null;
	device?: Device | null;
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

// Sessão só existe amarrada a um dispositivo conhecido: se a linha sumiu (revogada no PC), a sessão
// deixa de valer no mesmo instante, sem esperar o cookie expirar.
export async function resolveSessionDevice(params: {
	cookieHeader: string | null | undefined;
	userAgent: string | undefined;
	remoteAddress: string | null | undefined;
}) {
	const session = await resolveSession(params.cookieHeader);

	if (!session) {
		return null;
	}

	const device = await resolveApprovedDevice({
		deviceId: session.claims.deviceId,
		userId: session.user.id,
		userAgent: params.userAgent,
		ip: params.remoteAddress ?? undefined,
	});

	if (!device) {
		return null;
	}

	return { user: session.user, claims: session.claims, device };
}

const base = os.$context<Context>();

const authMiddleware = base.middleware(async ({ context, next }) => {
	if (context.user !== undefined) {
		return next({ context: { user: context.user, device: context.device ?? null } });
	}

	const session = await resolveSessionDevice({
		cookieHeader: context.reqHeaders?.get("cookie"),
		userAgent: context.reqHeaders?.get("user-agent") ?? undefined,
		remoteAddress: context.remoteAddress,
	});

	if (session && shouldRenewSession(session.claims)) {
		await issueSessionCookie({
			userId: session.user.id,
			sessionEpoch: session.user.session_epoch ?? 0,
			deviceId: session.device.id,
			resHeaders: context.resHeaders,
			reqHeaders: context.reqHeaders,
		});
	}

	return next({ context: { user: session?.user ?? null, device: session?.device ?? null } });
});

export const publicProcedure = base.use(authMiddleware);

export const protectedProcedure = publicProcedure.use(({ context, next }) => {
	if (!context.user) {
		throw new ORPCError("UNAUTHORIZED");
	}

	if (context.device?.status !== "approved") {
		throw new ORPCError("FORBIDDEN", {
			message: "Dispositivo não aprovado. Libere o acesso no computador.",
			data: { reason: DEVICE_NOT_APPROVED, status: context.device?.status ?? "unknown" },
		});
	}

	return next({ context: { user: context.user, device: context.device } });
});

// Governa quem pode governar: aprovar, bloquear e revogar dispositivo só vale de dentro da máquina
// (loopback). Nem uma sessão legítima do celular libera outro aparelho.
export const localProcedure = protectedProcedure.use(({ context, next }) => {
	if (!isLocalRequest({ reqHeaders: context.reqHeaders, remoteAddress: context.remoteAddress })) {
		throw new ORPCError("FORBIDDEN", {
			message: "Só o computador que roda o Kowork pode gerenciar dispositivos.",
		});
	}

	return next({ context });
});
