import { getAppEnv } from "@/lib/env";
import { isDesktop } from "@/lib/desktop";

export function registerServiceWorker(): void {
	if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
		return;
	}

	if (isDesktop()) {
		return;
	}

	if (getAppEnv() !== "production") {
		return;
	}

	window.addEventListener("load", function onLoad() {
		navigator.serviceWorker.register("/sw.js").catch(function onRegisterError(error) {
			console.error("[PWA] Falha ao registrar service worker:", error);
		});
	});
}
