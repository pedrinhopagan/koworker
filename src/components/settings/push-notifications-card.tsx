import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { isTauri } from "@/lib/tauri";

function applicationServerKey(value: string) {
	const padding = "=".repeat((4 - (value.length % 4)) % 4);
	const base64 = (value + padding).replaceAll("-", "+").replaceAll("_", "/");
	return Uint8Array.from(atob(base64), (character) => character.codePointAt(0) ?? 0);
}

function browserSupportsPush() {
	return (
		typeof window !== "undefined" &&
		"Notification" in window &&
		"serviceWorker" in navigator &&
		"PushManager" in window &&
		!isTauri()
	);
}

function notificationDescription(params: {
	supported: boolean;
	available: boolean;
	subscribed: boolean;
}) {
	if (params.supported) {
		if (params.available) {
			return params.subscribed
				? "Este dispositivo receberá conclusão, falha e pedidos de atenção."
				: "Receba alertas mesmo com o PWA fechado.";
		}
		return "O servidor ainda não possui as chaves de notificação configuradas.";
	}
	return "Disponível no PWA instalado em um navegador compatível.";
}

export function PushNotificationsCard() {
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

	const subscribeMutation = useMutation({
		...orpc.notifications.subscribe.mutationOptions(),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.notifications.status.key() }),
	});
	const unsubscribeMutation = useMutation({
		...orpc.notifications.unsubscribe.mutationOptions(),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.notifications.status.key() }),
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

	const pending =
		subscribeMutation.isPending || unsubscribeMutation.isPending || testMutation.isPending;
	const available = supported && statusQuery.data?.available && !!statusQuery.data.vapidPublicKey;

	async function handleSubscribe() {
		if (!statusQuery.data?.vapidPublicKey) {
			return;
		}

		const permission = await Notification.requestPermission();
		if (permission !== "granted") {
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

	async function handleUnsubscribe() {
		if (!subscription) {
			return;
		}

		const endpoint = subscription.endpoint;
		await subscription.unsubscribe();
		await unsubscribeMutation.mutateAsync({ endpoint });
		setSubscription(null);
		toast.success("Alertas desativados neste dispositivo");
	}

	const description = notificationDescription({
		supported,
		available: !!statusQuery.data?.available,
		subscribed: !!subscription,
	});

	return (
		<div className="flex flex-col gap-4 border border-border bg-card p-4 sm:flex-row sm:items-center">
			<div className="flex min-w-0 flex-1 items-start gap-3">
				<Icon icon={subscription ? BellRing : Bell} size="sm" className="mt-0.5" />
				<div className="space-y-1">
					<Title as="h3" size="sm" className="text-sm font-semibold">
						Alertas de execução
					</Title>
					<Text size="sm" tone="muted">
						{description}
					</Text>
				</div>
			</div>
			<div className="flex shrink-0 flex-wrap gap-2">
				{subscription && (
					<Button
						type="button"
						variant="outline"
						disabled={pending}
						onClick={() => testMutation.mutate({})}
					>
						{testMutation.isPending && <Loader2 className="size-4 animate-spin" />}
						Testar
					</Button>
				)}
				<Button
					type="button"
					variant={subscription ? "outline" : "default"}
					disabled={pending || (!subscription && !available)}
					onClick={() => void (subscription ? handleUnsubscribe() : handleSubscribe())}
				>
					{pending ? (
						<Loader2 className="size-4 animate-spin" />
					) : subscription ? (
						<BellOff className="size-4" />
					) : (
						<BellRing className="size-4" />
					)}
					{subscription ? "Desativar" : "Ativar alertas"}
				</Button>
			</div>
		</div>
	);
}
