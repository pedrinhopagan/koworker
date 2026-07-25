import { ORPCError } from "@orpc/server";

export const MAX_LOGIN_FAILURES_PER_NAME = 5;
export const MAX_LOGIN_FAILURES_GLOBAL = 20;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

type LoginAttempt = {
	failures: number;
	resetAt: number;
};

const attemptsByName = new Map<string, LoginAttempt>();

let globalAttempt: LoginAttempt = { failures: 0, resetAt: 0 };

function attemptKey(name: string) {
	return name.trim().toLowerCase();
}

function purgeExpired(now: number) {
	for (const [key, attempt] of attemptsByName) {
		if (now >= attempt.resetAt) {
			attemptsByName.delete(key);
		}
	}

	if (now >= globalAttempt.resetAt) {
		globalAttempt = { failures: 0, resetAt: 0 };
	}
}

function bump(attempt: LoginAttempt | undefined, now: number): LoginAttempt {
	if (!attempt || now >= attempt.resetAt) {
		return { failures: 1, resetAt: now + LOGIN_WINDOW_MS };
	}

	return { failures: attempt.failures + 1, resetAt: attempt.resetAt };
}

export function assertLoginAllowed(name: string) {
	const now = Date.now();
	purgeExpired(now);

	if (globalAttempt.failures >= MAX_LOGIN_FAILURES_GLOBAL) {
		throw new ORPCError("TOO_MANY_REQUESTS", {
			message: "Muitas tentativas de login. Tente novamente mais tarde.",
		});
	}

	const attempt = attemptsByName.get(attemptKey(name));
	if (attempt && attempt.failures >= MAX_LOGIN_FAILURES_PER_NAME) {
		throw new ORPCError("TOO_MANY_REQUESTS", {
			message: "Muitas tentativas de login. Tente novamente mais tarde.",
		});
	}
}

export function recordLoginFailure(name: string) {
	const now = Date.now();
	purgeExpired(now);

	attemptsByName.set(attemptKey(name), bump(attemptsByName.get(attemptKey(name)), now));
	globalAttempt = bump(globalAttempt, now);
}

export function clearLoginFailures(name: string) {
	attemptsByName.delete(attemptKey(name));
	globalAttempt = { failures: 0, resetAt: 0 };
}

export function resetLoginRateLimit() {
	attemptsByName.clear();
	globalAttempt = { failures: 0, resetAt: 0 };
}

export function loginRateLimitSize() {
	return attemptsByName.size;
}
