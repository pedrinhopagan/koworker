import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

import { orpcWs } from "@/client";
import { subscribeWithRetry } from "@/lib/realtime-subscription";
import { safeGetCurrentWindow } from "@/lib/tauri";

// O kw-terminal manda a rota da tarefa que o agente está trabalhando. A janela
// vem para a frente junto com a navegação: o clique aconteceu no terminal, e
// navegar sem aparecer deixaria a mudança invisível.
export function useNavigateEvents() {
	const router = useRouter();

	useEffect(() => {
		const controller = new AbortController();

		async function goTo(route: string) {
			await router.navigate({ to: route });

			const window = await safeGetCurrentWindow();
			await window?.show();
			await window?.setFocus();
		}

		subscribeWithRetry({
			label: "Navigate Events",
			signal: controller.signal,
			subscribe: (signal) => orpcWs.navigate.call(undefined, { signal }),
			onEvent: (event) => {
				goTo(event.route).catch((error) => {
					console.error("[Navigate Events] Falha ao navegar:", error);
				});
			},
		});

		// Clique na notificação do PWA: o service worker foca a janela e manda a rota por mensagem. A
		// navegação acontece no router, sem recarregar o app — `client.navigate()` remontaria o SPA
		// inteiro e, no iOS em modo standalone, nem sempre é aceito pelo cliente.
		function handleWorkerMessage(event: MessageEvent) {
			const data: unknown = event.data;
			if (
				typeof data !== "object" ||
				data === null ||
				(data as { type?: string }).type !== "kowork-navigate"
			) {
				return;
			}

			const route = (data as { route?: string }).route;
			if (route?.startsWith("/")) {
				void router.navigate({ to: route });
			}
		}

		navigator.serviceWorker?.addEventListener("message", handleWorkerMessage);

		return () => {
			controller.abort();
			navigator.serviceWorker?.removeEventListener("message", handleWorkerMessage);
		};
	}, [router]);
}
