import { beforeEach, describe, expect, test } from "bun:test";

import {
	assertLoginAllowed,
	clearLoginFailures,
	LOGIN_WINDOW_MS,
	loginRateLimitSize,
	MAX_LOGIN_FAILURES_GLOBAL,
	MAX_LOGIN_FAILURES_PER_IP,
	MAX_LOGIN_FAILURES_PER_NAME,
	recordLoginFailure,
	resetLoginRateLimit,
} from "./login-rate-limit";

beforeEach(() => {
	resetLoginRateLimit();
});

function failTimes(identity: { name: string; ip?: string }, times: number) {
	for (let i = 0; i < times; i++) {
		recordLoginFailure({ name: identity.name, ip: identity.ip ?? null });
	}
}

describe("limite por nome", () => {
	test("bloqueia depois do teto de falhas do mesmo nome", () => {
		failTimes({ name: "pedro" }, MAX_LOGIN_FAILURES_PER_NAME - 1);
		expect(() => assertLoginAllowed({ name: "pedro", ip: null })).not.toThrow();

		recordLoginFailure({ name: "pedro", ip: null });
		expect(() => assertLoginAllowed({ name: "pedro", ip: null })).toThrow();
	});

	test("normaliza caixa e espaços do nome", () => {
		failTimes({ name: "pedro" }, MAX_LOGIN_FAILURES_PER_NAME);

		expect(() => assertLoginAllowed({ name: "  PEDRO  ", ip: null })).toThrow();
	});

	test("login bem-sucedido libera o nome", () => {
		failTimes({ name: "pedro" }, MAX_LOGIN_FAILURES_PER_NAME);
		clearLoginFailures({ name: "pedro", ip: null });

		expect(() => assertLoginAllowed({ name: "pedro", ip: null })).not.toThrow();
	});
});

describe("limite por IP", () => {
	test("trocar de nome no mesmo IP não zera a contagem", () => {
		for (let i = 0; i < MAX_LOGIN_FAILURES_PER_IP; i++) {
			recordLoginFailure({ name: `nome-${i}`, ip: "203.0.113.7" });
		}

		expect(() => assertLoginAllowed({ name: "nome-novo", ip: "203.0.113.7" })).toThrow();
	});

	test("outro IP segue livre enquanto o teto global não estoura", () => {
		failTimes({ name: "pedro", ip: "203.0.113.7" }, MAX_LOGIN_FAILURES_PER_NAME);

		expect(() => assertLoginAllowed({ name: "outro", ip: "198.51.100.4" })).not.toThrow();
	});
});

describe("limite global", () => {
	test("rotacionar o nome não contorna o bloqueio", () => {
		for (let i = 0; i < MAX_LOGIN_FAILURES_GLOBAL; i++) {
			recordLoginFailure({ name: `nome-${i}`, ip: null });
		}

		expect(() => assertLoginAllowed({ name: "nome-novo-em-folha", ip: null })).toThrow();
	});

	test("o teto global é atingido antes do mapa crescer sem limite", () => {
		for (let i = 0; i < 500; i++) {
			try {
				assertLoginAllowed({ name: `nome-${i}`, ip: `198.51.100.${i % 255}` });
			} catch {
				break;
			}
			recordLoginFailure({ name: `nome-${i}`, ip: `198.51.100.${i % 255}` });
		}

		expect(loginRateLimitSize()).toBeLessThanOrEqual(MAX_LOGIN_FAILURES_GLOBAL * 2);
	});
});

describe("expurgo por janela", () => {
	test("entradas vencidas somem do mapa e liberam o login", () => {
		const realNow = Date.now;
		const start = realNow();

		try {
			failTimes({ name: "pedro" }, MAX_LOGIN_FAILURES_PER_NAME);
			expect(loginRateLimitSize()).toBe(1);

			Date.now = () => start + LOGIN_WINDOW_MS + 1;

			expect(() => assertLoginAllowed({ name: "pedro", ip: null })).not.toThrow();
			expect(loginRateLimitSize()).toBe(0);
		} finally {
			Date.now = realNow;
		}
	});
});
