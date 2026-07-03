export const DEFAULT_KOWORK_PORT = 2841;
export const KOWORK_PROD_PORT = 2842;
export const DEFAULT_KOWORK_API_ORIGIN = `http://localhost:${DEFAULT_KOWORK_PORT}`;
export const KOWORK_PROD_API_ORIGIN = `http://localhost:${KOWORK_PROD_PORT}`;

type AppEnv = "development" | "production";

type ResolveApiOriginParams = {
	windowApiUrl?: string;
	windowOrigin?: string;
	isTauriEnvironment: boolean;
	appEnv?: AppEnv;
};

export function resolveApiOrigin(params: ResolveApiOriginParams): string {
	const { windowApiUrl, windowOrigin, isTauriEnvironment, appEnv = "development" } = params;

	const apiUrl = windowApiUrl?.trim();
	if (apiUrl) {
		return apiUrl;
	}

	if (isTauriEnvironment || !windowOrigin) {
		return appEnv === "production" ? KOWORK_PROD_API_ORIGIN : DEFAULT_KOWORK_API_ORIGIN;
	}

	return windowOrigin;
}
