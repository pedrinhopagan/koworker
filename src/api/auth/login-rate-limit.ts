import { ORPCError } from "@orpc/server";

export const MAX_LOGIN_FAILURES_PER_NAME = 5;
export const MAX_LOGIN_FAILURES_PER_IP = 10;
export const MAX_LOGIN_FAILURES_GLOBAL = 20;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export interface LoginIdentity {
	name: string;
	ip: string | null | undefined;
}

type LoginAttempt = {
	failures: number;
	resetAt: number;
};

const attempts = new Map<string, LoginAttempt>();

let globalAttempt: LoginAttempt = { failures: 0, resetAt: 0 };

// O nome sozinho não segura quem varre usuários; o IP sozinho não segura quem troca de rede. As duas
// chaves contam na mesma janela e qualquer uma delas basta pra barrar.
function limitsFor(identity: LoginIdentity) {
	const limits = [
		{ key: `name:${identity.name.trim().toLowerCase()}`, max: MAX_LOGIN_FAILURES_PER_NAME },
	];

	if (identity.ip) {
		limits.push({ key: `ip:${identity.ip}`, max: MAX_LOGIN_FAILURES_PER_IP });
	}

	return limits;
}

function purgeExpired(now: number) {
	for (const [key, attempt] of attempts) {
		if (now >= attempt.resetAt) {
			attempts.delete(key);
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

export function assertLoginAllowed(identity: LoginIdentity) {
	const now = Date.now();
	purgeExpired(now);

	const blocked =
		globalAttempt.failures >= MAX_LOGIN_FAILURES_GLOBAL ||
		limitsFor(identity).some((limit) => (attempts.get(limit.key)?.failures ?? 0) >= limit.max);

	if (blocked) {
		throw new ORPCError("TOO_MANY_REQUESTS", {
			message: "Muitas tentativas de login. Tente novamente mais tarde.",
		});
	}
}

export function recordLoginFailure(identity: LoginIdentity) {
	const now = Date.now();
	purgeExpired(now);

	for (const limit of limitsFor(identity)) {
		attempts.set(limit.key, bump(attempts.get(limit.key), now));
	}

	globalAttempt = bump(globalAttempt, now);
}

export function clearLoginFailures(identity: LoginIdentity) {
	for (const limit of limitsFor(identity)) {
		attempts.delete(limit.key);
	}

	globalAttempt = { failures: 0, resetAt: 0 };
}

export function resetLoginRateLimit() {
	attempts.clear();
	globalAttempt = { failures: 0, resetAt: 0 };
}

export function loginRateLimitSize() {
	return attempts.size;
}
