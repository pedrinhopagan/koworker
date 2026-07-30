import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { isTauri } from "@/lib/tauri";

function applicationServerKey(value: string) {
	const padding = "=".repeat((4 - (value.length % 4)) % 4);
	const base64 = (value + padding).replaceAll("-", "+").replaceAll("_", "/");

	return Uint8Array.from(atob(base64), (character) => character.codePointAt(0) ?? 0);
}

// Push exige service worker, que exige contexto seguro. O Tauri fica de fora: o desktop recebe o
// mesmo alerta pelo canal in-app.
function browserSupportsPush() {
	return (
		typeof window !== "undefined" &&
		"Notification" in window &&
		"serviceWorker" in navigator &&
		"PushManager" in window &&
		!isTauri()
	);
}

export function usePushSubscription() {
	const queryClient = useQueryClient();
	const statusQuery = useQuery(orpc.notifications.status.queryOptions());
	const [subscription, setSubscription] = useState<PushSubscription | null>(null);
	const supported = browserSupportsPush();

	useEffect(() => {
		if (!supported) {
			return;
		}

		void navigator.serviceWorker.ready
			.then((registration) => registration.pushManager.getSubscription())
			.then(setSubscription);
	}, [supported]);

	const invalidateStatus = () =>
		queryClient.invalidateQueries({ queryKey: orpc.notifications.status.key() });

	const subscribeMutation = useMutation({
		...orpc.notifications.subscribe.mutationOptions(),
		onSuccess: invalidateStatus,
	});
	const unsubscribeMutation = useMutation({
		...orpc.notifications.unsubscribe.mutationOptions(),
		onSuccess: invalidateStatus,
	});
	const testMutation = useMutation({
		...orpc.notifications.test.mutationOptions(),
		onSuccess: ({ sent }) => {
			if (sent > 0) {
				toast.success("Notificação de teste enviada");

				return;
			}

			toast.error("O dispositivo não aceitou a notificação de teste");
		},
		onError: () => toast.error("Não foi possível enviar a notificação de teste"),
	});

	async function subscribe() {
		if (!statusQuery.data?.vapidPublicKey) {
			return;
		}

		if ((await Notification.requestPermission()) !== "granted") {
			toast.error("Permita notificações nas configurações do navegador");

			return;
		}

		try {
			const registration = await navigator.serviceWorker.ready;
			const next =
				(await registration.pushManager.getSubscription()) ??
				(await registration.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: applicationServerKey(statusQuery.data.vapidPublicKey),
				}));
			const json = next.toJSON();

			if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
				throw new Error("Assinatura push incompleta");
			}

			await subscribeMutation.mutateAsync({
				endpoint: json.endpoint,
				expirationTime: json.expirationTime,
				keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
			});
			setSubscription(next);
			toast.success("Alertas ativados neste dispositivo");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Não foi possível ativar os alertas");
		}
	}

	async function unsubscribe() {
		if (!subscription) {
			return;
		}

		const endpoint = subscription.endpoint;
		await subscription.unsubscribe();
		await unsubscribeMutation.mutateAsync({ endpoint });
		setSubscription(null);
		toast.success("Alertas desativados neste dispositivo");
	}

	return {
		supported,
		serverReady: !!statusQuery.data?.available,
		available: supported && !!statusQuery.data?.available && !!statusQuery.data.vapidPublicKey,
		subscription,
		busy: subscribeMutation.isPending || unsubscribeMutation.isPending || testMutation.isPending,
		testing: testMutation.isPending,
		subscribe,
		unsubscribe,
		test: () => testMutation.mutate({}),
	};
}
