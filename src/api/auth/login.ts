import { ORPCError } from "@orpc/server";
import { DbUsers } from "@/api/db/users";
import type { AuthLoginInput } from "@/api/schemas/auth";
import { assertLoginAllowed, clearLoginFailures, recordLoginFailure } from "./login-rate-limit";
import { clearSessionCookie, issueSessionCookie } from "./session";
import { closeWsSessionsForUser } from "./ws-sessions";

let decoyPasswordHash: Promise<string> | null = null;

function getDecoyPasswordHash() {
	decoyPasswordHash ??= Bun.password.hash(crypto.randomUUID());

	return decoyPasswordHash;
}

export const Auth = {
	async login(
		input: AuthLoginInput,
		resHeaders: Headers | undefined,
		reqHeaders: Headers | undefined,
	) {
		assertLoginAllowed(input.name);

		const user = await DbUsers.getByName(input.name);
		const passwordMatch = await Bun.password.verify(
			input.password,
			user ? user.password : await getDecoyPasswordHash(),
		);

		if (!user || !passwordMatch) {
			recordLoginFailure(input.name);
			throw new ORPCError("UNAUTHORIZED");
		}

		clearLoginFailures(input.name);

		await issueSessionCookie({
			userId: user.id,
			sessionEpoch: user.session_epoch ?? 0,
			resHeaders,
			reqHeaders,
		});

		return { id: user.id, name: user.name };
	},

	async logout(resHeaders: Headers | undefined, userId: number) {
		await DbUsers.bumpSessionEpoch(userId);
		clearSessionCookie(resHeaders);
		closeWsSessionsForUser(userId);

		return { ok: true };
	},
};
