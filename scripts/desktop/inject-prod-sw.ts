export function buildProductionServiceWorker(sourceSw: string, appVersion: string): string {
	return sourceSw.replaceAll("__KOWORK_SW_CACHE_VERSION__", appVersion);
}
