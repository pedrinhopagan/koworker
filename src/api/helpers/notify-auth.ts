const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

const FORWARDING_HEADERS = ["x-forwarded-for", "x-forwarded-host", "x-real-ip", "forwarded"];

function readBearerToken(headers: Headers) {
	const authorization = headers.get("authorization");
	const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;

	return bearer ?? headers.get("x-kowork-token");
}

export function isNotifyAuthorized(params: {
	headers: Headers;
	remoteAddress: string | null | undefined;
	notifyToken: string | undefined;
}) {
	if (params.notifyToken) {
		const token = readBearerToken(params.headers);

		return !!token && token === params.notifyToken;
	}

	if (FORWARDING_HEADERS.some((header) => params.headers.has(header))) {
		return false;
	}

	return !!params.remoteAddress && LOOPBACK_ADDRESSES.has(params.remoteAddress);
}
