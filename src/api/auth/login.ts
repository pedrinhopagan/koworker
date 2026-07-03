import { ORPCError } from "@orpc/server";
import { setCookie } from "@orpc/server/helpers";
import { envVariables } from "@/api/config/env";
import { DbUsers } from "@/api/db/users";
import type { AuthLoginInput } from "@/api/schemas/auth";
import { JWT } from "./jwt";

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

type LoginAttempt = {
	failures: number;
	resetAt: number;
};

const loginAttempts = new Map<string, LoginAttempt>();

function getAttemptKey(name: string) {
	return name.toLowerCase();
}

function checkRateLimit(name: string) {
	const key = getAttemptKey(name);
	const now = Date.now();
	const attempt = loginAttempts.get(key);

	if (!attempt) {
		return;
	}

	if (now >= attempt.resetAt) {
		loginAttempts.delete(key);
		return;
	}

	if (attempt.failures >= MAX_LOGIN_ATTEMPTS) {
		throw new ORPCError("TOO_MANY_REQUESTS");
	}
}

function recordLoginFailure(name: string) {
	const key = getAttemptKey(name);
	const now = Date.now();
	const attempt = loginAttempts.get(key);

	if (!attempt || now >= attempt.resetAt) {
		loginAttempts.set(key, { failures: 1, resetAt: now + LOGIN_WINDOW_MS });
		return;
	}

	attempt.failures += 1;
}

function clearLoginAttempts(name: string) {
	loginAttempts.delete(getAttemptKey(name));
}

function shouldUseSecureCookie(reqHeaders: Headers | undefined): boolean {
	const origin = reqHeaders?.get("origin") || "";
	const host = reqHeaders?.get("host") || "";
	const candidate = `${origin} ${host}`.toLowerCase();

	if (
		candidate.includes("localhost") ||
		candidate.includes("127.0.0.1") ||
		candidate.includes("[::1]")
	) {
		return false;
	}

	const forwardedProto = reqHeaders?.get("x-forwarded-proto");
	if (forwardedProto) {
		return forwardedProto.toLowerCase() === "https";
	}

	if (origin) {
		try {
			return new URL(origin).protocol === "https:";
		} catch {
			return envVariables.NODE_ENV === "production";
		}
	}

	return envVariables.NODE_ENV === "production";
}

export const Auth = {
	async login(
		input: AuthLoginInput,
		resHeaders: Headers | undefined,
		reqHeaders: Headers | undefined,
	) {
		checkRateLimit(input.name);

		const user = await DbUsers.getByName(input.name);

		if (!user) {
			recordLoginFailure(input.name);
			throw new ORPCError("UNAUTHORIZED");
		}

		const passwordMatch = await Bun.password.verify(input.password, user.password);

		if (!passwordMatch) {
			recordLoginFailure(input.name);
			throw new ORPCError("UNAUTHORIZED");
		}

		clearLoginAttempts(input.name);

		const token = await JWT.create({ userId: user.id });

		setCookie(resHeaders, "session", token, {
			httpOnly: true,
			secure: shouldUseSecureCookie(reqHeaders),
			sameSite: "lax",
			maxAge: 7 * 24 * 60 * 60,
			path: "/",
		});

		return { id: user.id, name: user.name };
	},

	logout(resHeaders: Headers | undefined) {
		setCookie(resHeaders, "session", "", { maxAge: 0, path: "/" });

		return { ok: true };
	},
};
