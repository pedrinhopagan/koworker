import { requireReplace } from "./require-replace";

export function buildProductionServiceWorker(sourceSw: string, appVersion: string): string {
	return requireReplace(
		sourceSw,
		/__KOWORK_SW_CACHE_VERSION__/g,
		appVersion,
		"injetar a versão de cache no service worker",
	);
}
