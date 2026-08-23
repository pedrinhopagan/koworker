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

	watchPwaUpdates();
}

// Sem isso, abrir o PWA depois de um deploy servia o JS antigo do cache (stale-while-revalidate) e
// a versão nova só valia no segundo reload — o celular parecia nunca atualizar. Aqui um SW
// genuinamente novo (skipWaiting + claim) dispara `controllerchange` e a página recarrega uma vez,
// sozinha. Checagens explícitas cobrem sessões longas sem navegação.
const RELOAD_GUARD_KEY = "kowork-pwa-reloaded-controller";
const UPDATE_CHECK_MIN_INTERVAL_MS = 60_000;
const UPDATE_CHECK_INTERVAL_MS = 30 * 60_000;

function watchPwaUpdates(): void {
	let hadController = navigator.serviceWorker.controller !== null;
	let lastCheckAt = 0;

	try {
		sessionStorage.removeItem(RELOAD_GUARD_KEY);
	} catch {
		// sessionStorage bloqueado: a guarda vira no-op e o reload único depende do evento em si
	}

	navigator.serviceWorker.addEventListener("controllerchange", function onControllerChange() {
		// Primeira instalação também "assume controle"; recarregar nela seria perder o estado de
		// abertura à toa. Só uma TROCA de controller é versão nova.
		if (!hadController) {
			hadController = true;
			return;
		}

		try {
			if (sessionStorage.getItem(RELOAD_GUARD_KEY)) {
				return;
			}
			sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
		} catch {
			// sem guarda disponível: segue com o reload único do evento
		}

		window.location.reload();
	});

	async function checkForUpdate() {
		const now = Date.now();
		if (now - lastCheckAt < UPDATE_CHECK_MIN_INTERVAL_MS) {
			return;
		}
		lastCheckAt = now;

		try {
			const registration = await navigator.serviceWorker.ready;
			await registration.update();
		} catch {
			// offline ou SW indisponível: tenta de novo no próximo gatilho
		}
	}

	document.addEventListener("visibilitychange", function onVisibilityChange() {
		if (document.visibilityState === "visible") {
			void checkForUpdate();
		}
	});

	window.setInterval(() => void checkForUpdate(), UPDATE_CHECK_INTERVAL_MS);
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
