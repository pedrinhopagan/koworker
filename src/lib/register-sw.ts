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

export async function activateLatestPwa(): Promise<void> {
	if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
		window.location.reload();
		return;
	}

	const registration = await navigator.serviceWorker.ready;
	const previousController = navigator.serviceWorker.controller;
	const controllerChanged = new Promise<void>((resolve) => {
		const timeout = window.setTimeout(resolve, 15_000);

		navigator.serviceWorker.addEventListener(
			"controllerchange",
			() => {
				window.clearTimeout(timeout);
				resolve();
			},
			{ once: true },
		);
	});

	await registration.update();

	if (previousController && (registration.installing || registration.waiting)) {
		await controllerChanged;
	}

	window.location.reload();
}
