import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, MonitorSmartphone, ShieldBan } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Text, Title } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteConfirmButton } from "@/components/ui/delete-confirm-button";
import { Icon } from "@/components/ui/icon";
import { useDevices } from "@/hooks/use-devices";
import { formatDateTime, relativeTimeFrom } from "@/lib/relative-time";

export const Route = createLazyFileRoute("/_app/dispositivos")({
	component: DispositivosPage,
});

type DeviceItem = ReturnType<typeof useDevices>["devices"][number];

const STATUS_BADGE = {
	pending: { variant: "warning" as const, label: "Aguardando liberação" },
	approved: { variant: "success" as const, label: "Liberado" },
	blocked: { variant: "destructive" as const, label: "Bloqueado" },
};

function DispositivosPage() {
	const navigate = useNavigate();
	const { devices, loading, canManage, approve, block, revoke, mutating } = useDevices();

	const pending = devices.filter((device) => device.status === "pending");
	const rest = devices.filter((device) => device.status !== "pending");

	return (
		<PageShell
			title="Dispositivos"
			description="Cada aparelho que acessa o Kowork precisa da sua liberação neste computador"
			icon={MonitorSmartphone}
			onBack={() => navigate({ to: "/configuracoes" })}
			contentClassName="min-h-0 flex-1 overflow-y-auto px-4 pb-8"
		>
			<div className="mx-auto w-full max-w-3xl space-y-8">
				{!canManage && (
					<div className="border border-accent/40 bg-accent/10 p-4">
						<Text size="sm">
							Você está vendo a lista de outro aparelho. Liberar, bloquear ou remover só funciona no
							app aberto no computador que roda o Kowork.
						</Text>
					</div>
				)}

				{loading && (
					<Text size="sm" tone="muted">
						Carregando dispositivos...
					</Text>
				)}

				{pending.length > 0 && (
					<section className="space-y-3">
						<Title as="h2" size="xs" className="uppercase tracking-wide text-muted-foreground">
							Pedidos de acesso
						</Title>

						{pending.map((device) => (
							<DeviceRow
								key={device.id}
								device={device}
								canManage={canManage}
								busy={mutating}
								onApprove={() => approve(device.id)}
								onBlock={() => block(device.id)}
								onRevoke={() => revoke(device.id)}
							/>
						))}
					</section>
				)}

				<section className="space-y-3">
					<Title as="h2" size="xs" className="uppercase tracking-wide text-muted-foreground">
						Dispositivos conhecidos
					</Title>

					{rest.length === 0 && !loading && (
						<Text size="sm" tone="muted">
							Nenhum dispositivo além dos pedidos acima.
						</Text>
					)}

					{rest.map((device) => (
						<DeviceRow
							key={device.id}
							device={device}
							canManage={canManage}
							busy={mutating}
							onApprove={() => approve(device.id)}
							onBlock={() => block(device.id)}
							onRevoke={() => revoke(device.id)}
						/>
					))}
				</section>
			</div>
		</PageShell>
	);
}

type DeviceRowProps = {
	device: DeviceItem;
	canManage: boolean;
	busy: boolean;
	onApprove: () => void;
	onBlock: () => void;
	onRevoke: () => void;
};

function DeviceRow({ device, canManage, busy, onApprove, onBlock, onRevoke }: DeviceRowProps) {
	const status = STATUS_BADGE[device.status];

	return (
		<div className="flex flex-col gap-4 border border-border bg-card p-4 sm:flex-row sm:items-start sm:justify-between">
			<div className="flex min-w-0 items-start gap-3">
				<Icon icon={MonitorSmartphone} size="sm" className="mt-0.5 shrink-0" />

				<div className="min-w-0 space-y-1">
					<div className="flex flex-wrap items-center gap-2">
						<Title as="h3" size="sm" className="text-sm font-semibold">
							{device.name}
						</Title>

						<Badge variant={status.variant}>{status.label}</Badge>

						{device.current && <Badge variant="muted">Este aparelho</Badge>}
					</div>

					<Text size="sm" tone="muted" className="break-words">
						Visto {relativeTimeFrom(device.lastSeenAt)}
						{device.lastIp && ` · ${device.lastIp}`}
					</Text>

					<Text size="sm" tone="muted" className="break-words">
						Primeiro acesso em {formatDateTime(device.createdAt)}
					</Text>
				</div>
			</div>

			{canManage && (
				<div className="flex shrink-0 items-center gap-2">
					{device.status !== "approved" && (
						<Button size="sm" onClick={onApprove} disabled={busy}>
							<Check className="mr-2 size-4" />
							Liberar
						</Button>
					)}

					{device.status === "approved" && !device.current && (
						<Button size="sm" variant="outline" onClick={onBlock} disabled={busy}>
							<ShieldBan className="mr-2 size-4" />
							Bloquear
						</Button>
					)}

					{!device.current && (
						<DeleteConfirmButton
							onDelete={onRevoke}
							disabled={busy}
							title={`Remover ${device.name}`}
							confirmTitle="Confirmar remoção"
						/>
					)}
				</div>
			)}
		</div>
	);
}
