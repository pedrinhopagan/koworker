import { ORPCError } from "@orpc/server";
import { DbUsers } from "@/api/db/users";
import type { AuthLoginInput } from "@/api/schemas/auth";
import { resolveOrRegisterDevice } from "./device";
import { assertLoginAllowed, clearLoginFailures, recordLoginFailure } from "./login-rate-limit";
import { clearSessionCookie, issueSessionCookie } from "./session";
import { closeWsSessionsForUser } from "./ws-sessions";

let decoyPasswordHash: Promise<string> | null = null;

function getDecoyPasswordHash() {
	decoyPasswordHash ??= Bun.password.hash(crypto.randomUUID());

	return decoyPasswordHash;
}

export const Auth = {
	async login(params: {
		input: AuthLoginInput;
		resHeaders: Headers | undefined;
		reqHeaders: Headers | undefined;
		remoteAddress: string | null | undefined;
	}) {
		const identity = { name: params.input.name, ip: params.remoteAddress };
		assertLoginAllowed(identity);

		const user = await DbUsers.getByName(params.input.name);
		const passwordMatch = await Bun.password.verify(
			params.input.password,
			user ? user.password : await getDecoyPasswordHash(),
		);

		if (!user || !passwordMatch) {
			recordLoginFailure(identity);
			throw new ORPCError("UNAUTHORIZED");
		}

		clearLoginFailures(identity);

		const device = await resolveOrRegisterDevice({
			userId: user.id,
			reqHeaders: params.reqHeaders,
			resHeaders: params.resHeaders,
			remoteAddress: params.remoteAddress,
		});

		if (device.status === "blocked") {
			throw new ORPCError("FORBIDDEN", {
				message: "Dispositivo bloqueado. Libere no computador para voltar a usar.",
			});
		}

		// Dispositivo pendente também recebe a sessão: ela não abre nenhuma rota protegida, só
		// permite a tela de espera perguntar se a liberação já saiu.
		await issueSessionCookie({
			userId: user.id,
			sessionEpoch: user.session_epoch ?? 0,
			deviceId: device.id,
			resHeaders: params.resHeaders,
			reqHeaders: params.reqHeaders,
		});

		return {
			id: user.id,
			name: user.name,
			device: { id: device.id, name: device.name, status: device.status },
		};
	},

	async logout(resHeaders: Headers | undefined, userId: number) {
		await DbUsers.bumpSessionEpoch(userId);
		clearSessionCookie(resHeaders);
		closeWsSessionsForUser(userId);

		return { ok: true };
	},
};
