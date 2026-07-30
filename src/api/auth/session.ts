import { setCookie } from "@orpc/server/helpers";
import { type } from "arktype";
import * as jose from "jose";
import { envVariables } from "@/api/config/env";

export const SECRET = new TextEncoder().encode(envVariables.JWT_SECRET);

export const SESSION_COOKIE_NAME =
	envVariables.NODE_ENV === "production" ? "session" : "session_dev";

export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const SESSION_RENEW_THRESHOLD_SECONDS = SESSION_MAX_AGE_SECONDS / 2;

const sessionClaimsSchema = type({
	userId: "number",
	sessionEpoch: "number.integer",
	// Amarra a sessão ao dispositivo aprovado. Token antigo, sem esse campo, não valida mais:
	// quem tinha sessão viva antes do portão de dispositivos refaz o login uma vez.
	deviceId: "string",
	"exp?": "number",
});

export type SessionClaims = typeof sessionClaimsSchema.infer;

function createSessionToken(params: { userId: number; sessionEpoch: number; deviceId: string }) {
	return new jose.SignJWT({
		userId: params.userId,
		sessionEpoch: params.sessionEpoch,
		deviceId: params.deviceId,
	})
		.setProtectedHeader({ alg: "HS256" })
		.setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
		.sign(SECRET);
}

export async function verifySessionToken(token: string) {
	try {
		const { payload } = await jose.jwtVerify(token, SECRET);
		return sessionClaimsSchema.assert(payload);
	} catch {
		return null;
	}
}

export function readCookieValues(cookieHeader: string | null | undefined, cookieName: string) {
	if (!cookieHeader) {
		return [];
	}

	const prefix = `${cookieName}=`;

	return cookieHeader
		.split(";")
		.map((entry) => entry.trim())
		.filter((entry) => entry.startsWith(prefix))
		.map((entry) => decodeURIComponent(entry.slice(prefix.length)))
		.filter((token) => token.length > 0);
}

export function readSessionTokens(cookieHeader: string | null | undefined) {
	return readCookieValues(cookieHeader, SESSION_COOKIE_NAME);
}

export function shouldRenewSession(claims: SessionClaims) {
	if (!claims.exp) {
		return true;
	}

	return claims.exp - Math.floor(Date.now() / 1000) < SESSION_RENEW_THRESHOLD_SECONDS;
}

export function shouldUseSecureCookie(reqHeaders: Headers | undefined): boolean {
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

export async function issueSessionCookie(params: {
	userId: number;
	sessionEpoch: number;
	deviceId: string;
	resHeaders: Headers | undefined;
	reqHeaders: Headers | undefined;
}) {
	const token = await createSessionToken({
		userId: params.userId,
		sessionEpoch: params.sessionEpoch,
		deviceId: params.deviceId,
	});

	setCookie(params.resHeaders, SESSION_COOKIE_NAME, token, {
		httpOnly: true,
		secure: shouldUseSecureCookie(params.reqHeaders),
		sameSite: "lax",
		maxAge: SESSION_MAX_AGE_SECONDS,
		path: "/",
	});
}

export function clearSessionCookie(resHeaders: Headers | undefined) {
	setCookie(resHeaders, SESSION_COOKIE_NAME, "", { maxAge: 0, path: "/" });
}
