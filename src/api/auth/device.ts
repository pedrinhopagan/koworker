import { setCookie } from "@orpc/server/helpers";
import { type } from "arktype";
import * as jose from "jose";

import { envVariables } from "@/api/config/env";
import { DbDevices } from "@/api/db/devices";
import { isLoopbackRequest } from "@/api/helpers/notify-auth";
import { PushNotifications } from "@/api/helpers/push-notifications";
import { PubSub } from "@/api/pubsub";
import { readCookieValues, SECRET, shouldUseSecureCookie } from "./session";

const DEVICE_COOKIE_NAME = envVariables.NODE_ENV === "production" ? "device" : "device_dev";

const DEVICE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

// Um toque por minuto basta pra "visto por último": sem isso todo request viraria um UPDATE.
const TOUCH_INTERVAL_MS = 60_000;

export const DEVICE_NOT_APPROVED = "DEVICE_NOT_APPROVED";

const deviceClaimsSchema = type({ deviceId: "string" });

const OS_MATCHERS = [
	{ pattern: /iphone/i, label: "iPhone" },
	{ pattern: /ipad/i, label: "iPad" },
	{ pattern: /android/i, label: "Android" },
	{ pattern: /windows/i, label: "Windows" },
	{ pattern: /mac os|macintosh/i, label: "macOS" },
	{ pattern: /linux/i, label: "Linux" },
];

const BROWSER_MATCHERS = [
	{ pattern: /edg\//i, label: "Edge" },
	{ pattern: /opr\/|opera/i, label: "Opera" },
	{ pattern: /firefox/i, label: "Firefox" },
	{ pattern: /chrome|chromium/i, label: "Chrome" },
	{ pattern: /safari/i, label: "Safari" },
	{ pattern: /electron/i, label: "App desktop" },
];

export function deviceNameFromUserAgent(userAgent: string | null | undefined) {
	if (!userAgent) {
		return "Dispositivo desconhecido";
	}

	const os = OS_MATCHERS.find((matcher) => matcher.pattern.test(userAgent))?.label;
	const browser = BROWSER_MATCHERS.find((matcher) => matcher.pattern.test(userAgent))?.label;

	const parts = [os, browser].filter(Boolean);

	return parts.length > 0 ? parts.join(" · ") : "Dispositivo desconhecido";
}

function createDeviceToken(deviceId: string) {
	return new jose.SignJWT({ deviceId })
		.setProtectedHeader({ alg: "HS256" })
		.setExpirationTime(`${DEVICE_MAX_AGE_SECONDS}s`)
		.sign(SECRET);
}

async function readDeviceId(cookieHeader: string | null | undefined) {
	for (const token of readCookieValues(cookieHeader, DEVICE_COOKIE_NAME)) {
		try {
			const { payload } = await jose.jwtVerify(token, SECRET);

			return deviceClaimsSchema.assert(payload).deviceId;
		} catch {
			continue;
		}
	}

	return null;
}

async function issueDeviceCookie(params: {
	deviceId: string;
	resHeaders: Headers | undefined;
	reqHeaders: Headers | undefined;
}) {
	setCookie(params.resHeaders, DEVICE_COOKIE_NAME, await createDeviceToken(params.deviceId), {
		httpOnly: true,
		secure: shouldUseSecureCookie(params.reqHeaders),
		sameSite: "lax",
		maxAge: DEVICE_MAX_AGE_SECONDS,
		path: "/",
	});
}

// Requisição que nasce dentro da máquina é o próprio dono: o app desktop fala com o backend por
// localhost. É por aí que o primeiro dispositivo entra sem precisar de alguém já aprovado.
export function isLocalRequest(params: {
	reqHeaders: Headers | undefined;
	remoteAddress: string | null | undefined;
}) {
	return isLoopbackRequest({
		headers: params.reqHeaders ?? new Headers(),
		remoteAddress: params.remoteAddress,
	});
}

async function announcePendingDevice(params: { userId: number; deviceName: string }) {
	await PubSub.publish("notification", String(params.userId), {
		title: "Novo dispositivo pedindo acesso",
		message: `${params.deviceName} tentou entrar. Aprove no computador para liberar.`,
	});

	await PushNotifications.send(params.userId, {
		title: "Novo dispositivo pedindo acesso",
		body: `${params.deviceName} tentou entrar. Aprove no computador para liberar.`,
		url: "/dispositivos",
		tag: "kowork-device-pending",
	}).catch((error) => {
		console.error("[Devices] Falha ao notificar dispositivo pendente:", error);
	});
}

export async function resolveOrRegisterDevice(params: {
	userId: number;
	reqHeaders: Headers | undefined;
	resHeaders: Headers | undefined;
	remoteAddress: string | null | undefined;
}) {
	const userAgent = params.reqHeaders?.get("user-agent") ?? undefined;
	const ip = params.remoteAddress ?? undefined;
	const knownId = await readDeviceId(params.reqHeaders?.get("cookie"));
	const known = knownId ? await DbDevices.getById(knownId) : undefined;

	if (known && known.user_id === params.userId) {
		await DbDevices.touch(known.id, { userAgent, ip });
		await issueDeviceCookie({
			deviceId: known.id,
			resHeaders: params.resHeaders,
			reqHeaders: params.reqHeaders,
		});

		return known;
	}

	const local = isLocalRequest({
		reqHeaders: params.reqHeaders,
		remoteAddress: params.remoteAddress,
	});
	const device = await DbDevices.create({
		userId: params.userId,
		name: deviceNameFromUserAgent(userAgent),
		status: local ? "approved" : "pending",
		userAgent,
		ip,
	});

	await issueDeviceCookie({
		deviceId: device.id,
		resHeaders: params.resHeaders,
		reqHeaders: params.reqHeaders,
	});

	if (device.status === "pending") {
		await announcePendingDevice({ userId: params.userId, deviceName: device.name });
	}

	return device;
}

// Aparelho que entrou pelo QR nasce aprovado: quem leu o código estava na frente do computador, que
// é exatamente a prova que a fila de pendentes existe para obter.
export async function registerPairedDevice(params: {
	userId: number;
	reqHeaders: Headers | undefined;
	resHeaders: Headers | undefined;
	remoteAddress: string | null | undefined;
}) {
	const userAgent = params.reqHeaders?.get("user-agent") ?? undefined;
	const device = await DbDevices.create({
		userId: params.userId,
		name: deviceNameFromUserAgent(userAgent),
		status: "approved",
		userAgent,
		ip: params.remoteAddress ?? undefined,
	});

	await issueDeviceCookie({
		deviceId: device.id,
		resHeaders: params.resHeaders,
		reqHeaders: params.reqHeaders,
	});

	return device;
}

export async function resolveApprovedDevice(params: {
	deviceId: string;
	userId: number;
	userAgent: string | undefined;
	ip: string | undefined;
}) {
	const device = await DbDevices.getById(params.deviceId);

	if (!device || device.user_id !== params.userId) {
		return null;
	}

	if (Date.now() - device.last_seen_at > TOUCH_INTERVAL_MS) {
		await DbDevices.touch(device.id, { userAgent: params.userAgent, ip: params.ip });
	}

	return device;
}
