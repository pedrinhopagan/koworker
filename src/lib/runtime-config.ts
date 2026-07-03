export const DEFAULT_KOWORK_PORT = 2841;
export const KOWORK_PROD_PORT = 2842;
export const DEFAULT_KOWORK_API_ORIGIN = `http://localhost:${DEFAULT_KOWORK_PORT}`;
export const KOWORK_PROD_API_ORIGIN = `http://localhost:${KOWORK_PROD_PORT}`;

type AppEnv = "development" | "production";

type ResolveApiOriginParams = {
	windowOrigin?: string;
	isTauriEnvironment: boolean;
	appEnv?: AppEnv;
};

export function resolveApiOrigin(params: ResolveApiOriginParams): string {
	const { windowOrigin, isTauriEnvironment, appEnv = "development" } = params;

	// Navegador web fala sempre com a mesma origem que serviu o app (Caddy faz o proxy de /rpc).
	if (!isTauriEnvironment && windowOrigin) {
		return windowOrigin;
	}

	// Tauri (ou SSR sem origem) roda o backend localmente: 2842 em prod, 2841 em dev.
	return appEnv === "production" ? KOWORK_PROD_API_ORIGIN : DEFAULT_KOWORK_API_ORIGIN;
}
