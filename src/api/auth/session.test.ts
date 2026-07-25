import { expect, test } from "bun:test";

process.env.DATABASE_URL = ":memory:";
process.env.JWT_SECRET = "session-test-secret";
process.env.NODE_ENV = "development";

const {
	SESSION_COOKIE_NAME,
	SESSION_MAX_AGE_SECONDS,
	issueSessionCookie,
	readSessionTokens,
	shouldRenewSession,
	verifySessionToken,
} = await import("./session");

test("nome do cookie separa dev de produção no mesmo host", () => {
	expect(SESSION_COOKIE_NAME).toBe("session_dev");
});

test("lê todos os tokens quando o jar do webview acumula duplicatas", () => {
	const tokens = readSessionTokens(
		`session=de-outro-ambiente; ${SESSION_COOKIE_NAME}=antigo; ${SESSION_COOKIE_NAME}=novo`,
	);

	expect(tokens).toEqual(["antigo", "novo"]);
});

test("emite sessão longa e verificável", async () => {
	const resHeaders = new Headers();

	await issueSessionCookie({ userId: 7, sessionEpoch: 0, resHeaders, reqHeaders: new Headers() });

	const cookie = resHeaders.get("set-cookie") ?? "";

	expect(cookie).toContain(`Max-Age=${SESSION_MAX_AGE_SECONDS}`);

	const [token] = readSessionTokens(cookie.split(";")[0]);
	const claims = await verifySessionToken(token);

	expect(claims?.userId).toBe(7);
	expect(shouldRenewSession(claims!)).toBe(false);
});

test("renova quando passa da metade da validade", () => {
	const almostExpired = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS / 4;

	expect(shouldRenewSession({ userId: 7, sessionEpoch: 0, exp: almostExpired })).toBe(true);
});
