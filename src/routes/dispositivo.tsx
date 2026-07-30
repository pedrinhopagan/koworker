import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MonitorSmartphone, ShieldCheck } from "lucide-react";
import { useEffect } from "react";

import { orpc, reconnectRealtime } from "@/client";
import { PageShell } from "@/components/layout/page-shell";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";

export const Route = createFileRoute("/dispositivo")({
	component: DispositivoPage,
});

const POLL_INTERVAL_MS = 5000;

const COPY = {
	blocked: {
		icon: MonitorSmartphone,
		title: "Dispositivo bloqueado",
		text: "Este aparelho foi bloqueado. Libere no computador que roda o Kowork para voltar a usar.",
	},
	waiting: {
		icon: ShieldCheck,
		title: "Aguardando liberação",
		text: "Este aparelho ainda não tem acesso. Abra o Kowork no computador, vá em Configurações → Dispositivos e libere o acesso. Esta tela segue sozinha quando isso acontecer.",
	},
};

function DispositivoPage() {
	const navigate = useNavigate();
	const { data } = useQuery({
		...orpc.auth.session.queryOptions(),
		refetchInterval: POLL_INTERVAL_MS,
	});

	const status = data?.device?.status;
	const copy = status === "blocked" ? COPY.blocked : COPY.waiting;

	useEffect(() => {
		if (!data) {
			return;
		}

		if (!data.user) {
			void navigate({ to: "/login" });

			return;
		}

		if (status === "approved") {
			reconnectRealtime();
			void navigate({ to: "/" });
		}
	}, [data, status, navigate]);

	return (
		<PageShell title="Acesso do dispositivo" icon={MonitorSmartphone}>
			<div className="flex flex-1 items-center justify-center px-4 py-8">
				<Card className="w-full max-w-md">
					<CardHeader className="flex flex-row items-center gap-3">
						<Icon icon={copy.icon} size="sm" />
						<Title size="md">{copy.title}</Title>
					</CardHeader>

					<CardContent className="space-y-4">
						<Text size="sm" tone="muted">
							{copy.text}
						</Text>

						{data?.device && (
							<div className="border border-border bg-muted/30 p-3">
								<Text size="sm">{data.device.name}</Text>
							</div>
						)}

						<Button variant="outline" className="w-full" onClick={() => navigate({ to: "/login" })}>
							Entrar com outra conta
						</Button>
					</CardContent>
				</Card>
			</div>
		</PageShell>
	);
}
