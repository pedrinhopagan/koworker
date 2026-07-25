import { beforeEach, describe, expect, test } from "bun:test";

import {
	assertLoginAllowed,
	clearLoginFailures,
	LOGIN_WINDOW_MS,
	loginRateLimitSize,
	MAX_LOGIN_FAILURES_GLOBAL,
	MAX_LOGIN_FAILURES_PER_NAME,
	recordLoginFailure,
	resetLoginRateLimit,
} from "./login-rate-limit";

beforeEach(() => {
	resetLoginRateLimit();
});

function failTimes(name: string, times: number) {
	for (let i = 0; i < times; i++) {
		recordLoginFailure(name);
	}
}

describe("limite por nome", () => {
	test("bloqueia depois do teto de falhas do mesmo nome", () => {
		failTimes("pedro", MAX_LOGIN_FAILURES_PER_NAME - 1);
		expect(() => assertLoginAllowed("pedro")).not.toThrow();

		recordLoginFailure("pedro");
		expect(() => assertLoginAllowed("pedro")).toThrow();
	});

	test("normaliza caixa e espaços do nome", () => {
		failTimes("pedro", MAX_LOGIN_FAILURES_PER_NAME);

		expect(() => assertLoginAllowed("  PEDRO  ")).toThrow();
	});

	test("login bem-sucedido libera o nome", () => {
		failTimes("pedro", MAX_LOGIN_FAILURES_PER_NAME);
		clearLoginFailures("pedro");

		expect(() => assertLoginAllowed("pedro")).not.toThrow();
	});
});

describe("limite global", () => {
	test("rotacionar o nome não contorna o bloqueio", () => {
		for (let i = 0; i < MAX_LOGIN_FAILURES_GLOBAL; i++) {
			recordLoginFailure(`nome-${i}`);
		}

		expect(() => assertLoginAllowed("nome-novo-em-folha")).toThrow();
	});

	test("o teto global é atingido antes do mapa crescer sem limite", () => {
		for (let i = 0; i < 500; i++) {
			try {
				assertLoginAllowed(`nome-${i}`);
			} catch {
				break;
			}
			recordLoginFailure(`nome-${i}`);
		}

		expect(loginRateLimitSize()).toBeLessThanOrEqual(MAX_LOGIN_FAILURES_GLOBAL);
	});
});

describe("expurgo por janela", () => {
	test("entradas vencidas somem do mapa e liberam o login", () => {
		const realNow = Date.now;
		const start = realNow();

		try {
			failTimes("pedro", MAX_LOGIN_FAILURES_PER_NAME);
			expect(loginRateLimitSize()).toBe(1);

			Date.now = () => start + LOGIN_WINDOW_MS + 1;

			expect(() => assertLoginAllowed("pedro")).not.toThrow();
			expect(loginRateLimitSize()).toBe(0);
		} finally {
			Date.now = realNow;
		}
	});
});
