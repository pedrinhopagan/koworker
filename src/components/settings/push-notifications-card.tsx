import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";

import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { usePushSubscription } from "@/hooks/use-push-subscription";

function notificationDescription(params: {
	supported: boolean;
	serverReady: boolean;
	subscribed: boolean;
}) {
	if (!params.supported) {
		return "Disponível no PWA instalado em um navegador compatível.";
	}

	if (!params.serverReady) {
		return "O servidor ainda não possui as chaves de notificação configuradas.";
	}

	return params.subscribed
		? "Este dispositivo receberá conclusão, falha e pedidos de atenção."
		: "Receba alertas mesmo com o PWA fechado.";
}

export function PushNotificationsCard() {
	const push = usePushSubscription();
	const subscribed = !!push.subscription;

	return (
		<div className="flex flex-col gap-4 border border-border bg-card p-4 sm:flex-row sm:items-center">
			<div className="flex min-w-0 flex-1 items-start gap-3">
				<Icon icon={subscribed ? BellRing : Bell} size="sm" className="mt-0.5" />
				<div className="space-y-1">
					<Title as="h3" size="sm" className="text-sm font-semibold">
						Alertas de execução
					</Title>
					<Text size="sm" tone="muted">
						{notificationDescription({
							supported: push.supported,
							serverReady: push.serverReady,
							subscribed,
						})}
					</Text>
				</div>
			</div>
			<div className="flex shrink-0 flex-wrap gap-2">
				{subscribed && (
					<Button type="button" variant="outline" disabled={push.busy} onClick={push.test}>
						{push.testing && <Loader2 className="size-4 animate-spin" />}
						Testar
					</Button>
				)}
				<Button
					type="button"
					variant={subscribed ? "outline" : "default"}
					disabled={push.busy || (!subscribed && !push.available)}
					onClick={() => void (subscribed ? push.unsubscribe() : push.subscribe())}
				>
					{push.busy ? (
						<Loader2 className="size-4 animate-spin" />
					) : subscribed ? (
						<BellOff className="size-4" />
					) : (
						<BellRing className="size-4" />
					)}
					{subscribed ? "Desativar" : "Ativar alertas"}
				</Button>
			</div>
		</div>
	);
}
