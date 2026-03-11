export const DEFAULT_KOWORK_PORT = 4178;
export const DEFAULT_KOWORK_API_ORIGIN = `http://localhost:${DEFAULT_KOWORK_PORT}`;

type ResolveApiOriginParams = {
	windowApiUrl?: string;
	windowOrigin?: string;
	isTauriEnvironment: boolean;
};

export function resolveApiOrigin(params: ResolveApiOriginParams): string {
	const { windowApiUrl, windowOrigin, isTauriEnvironment } = params;

	if (windowApiUrl) {
		return windowApiUrl;
	}

	if (isTauriEnvironment || !windowOrigin) {
		return DEFAULT_KOWORK_API_ORIGIN;
	}

	return windowOrigin;
}
