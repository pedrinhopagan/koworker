export const DEFAULT_KOWORK_PORT = 2841;
export const KOWORK_PROD_PORT = 2842;
export const DEFAULT_KOWORK_API_ORIGIN = `http://localhost:${DEFAULT_KOWORK_PORT}`;
export const KOWORK_PROD_API_ORIGIN = `http://localhost:${KOWORK_PROD_PORT}`;

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
