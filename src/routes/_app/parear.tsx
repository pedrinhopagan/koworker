import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { QrCode, RefreshCw } from "lucide-react";

import { orpc } from "@/client";
import { PageShell } from "@/components/layout/page-shell";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { useSystemSettings } from "@/hooks/use-system-settings";

export const Route = createFileRoute("/_app/parear")({
	component: PairingPage,
});

function PairingPage() {
	const navigate = useNavigate();
	const { settings } = useSystemSettings();
	const pairing = useMutation(orpc.pairing.start.mutationOptions());

	return (
		<PageShell
			title="Entrar pelo celular"
			description="Abra o Kowork no celular sem digitar usuário e senha"
			icon={QrCode}
			onBack={() => navigate({ to: "/configuracoes" })}
			contentClassName="min-h-0 flex-1 overflow-y-auto px-4 pb-8"
		>
			<div className="mx-auto w-full max-w-md space-y-6">
				{settings && !settings.mobileBaseUrl && (
					<div className="space-y-2 border border-accent/40 bg-accent/10 p-4">
						<Text size="sm">
							Falta informar por qual endereço o celular alcança este computador.
						</Text>

						<Button variant="outline" size="sm" onClick={() => navigate({ to: "/sistema" })}>
							Configurar em Sistema
						</Button>
					</div>
				)}

				<div className="space-y-3 border border-border bg-card p-4">
					<Title as="h2" size="sm">
						Acesso rápido
					</Title>

					<Text size="sm" tone="muted">
						Gere o QR e leia com a câmera do celular. O Kowork abre com sua conta, sem pedir
						credenciais. O código vale por dois minutos e só pode ser usado uma vez.
					</Text>

					<Button
						className="w-full"
						disabled={pairing.isPending || !settings?.mobileBaseUrl}
						onClick={() => pairing.mutate({})}
					>
						<RefreshCw className="size-4" />
						{pairing.data ? "Gerar outro QR" : "Gerar QR"}
					</Button>

					{pairing.isError && (
						<Text size="sm" tone="muted">
							{pairing.error.message}
						</Text>
					)}
				</div>

				{pairing.data && (
					<div className="space-y-3 border border-border bg-card p-4">
						<div
							className="mx-auto w-full max-w-64 bg-white p-3 [&_svg]:h-auto [&_svg]:w-full"
							dangerouslySetInnerHTML={{ __html: pairing.data.qrSvg }}
						/>

						<Text size="xs" tone="muted" className="break-all text-center font-mono">
							{pairing.data.url}
						</Text>
					</div>
				)}
			</div>
		</PageShell>
	);
}
