export type AppEnv = "development" | "production";

declare global {
	interface Window {
		__KOWORK_ENV__?: AppEnv;
		__KOWORK_APP_VERSION__?: string;
	}
}

export function getAppEnv(): AppEnv {
	if (typeof window === "undefined") {
		return "development";
	}

	return window.__KOWORK_ENV__ === "production" ? "production" : "development";
}

export function isDevelopmentEnvironment(): boolean {
	return getAppEnv() === "development";
}

export function getAppVersionFallback(): string {
	if (typeof window === "undefined") {
		return "0.0.0";
	}

	return window.__KOWORK_APP_VERSION__ || "0.0.0";
}
