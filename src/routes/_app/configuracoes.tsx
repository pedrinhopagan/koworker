import { sweepAllActiveTerminals } from "@/lib/terminal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	ArrowRight,
	Brush,
	MonitorSmartphone,
	Palette,
	QrCode,
	RefreshCw,
	Settings,
} from "lucide-react";
import { useEffect } from "react";
import { toast } from "@/components/ui/toast";

import { orpc } from "@/client";
import { ConfigCard, UpdateCallChip } from "@/components/settings/config-card";
import { PushNotificationsCard } from "@/components/settings/push-notifications-card";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useDevices } from "@/hooks/use-devices";
import { activateLatestPwa } from "@/lib/register-sw";
import { PageShell } from "../../components/layout/page-shell";

export const Route = createFileRoute("/_app/configuracoes")({
	component: ConfiguracoesPage,
});

function isRedeployConflict(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code: string }).code === "CONFLICT"
	);
}

function RedeployAppCard() {
	const queryClient = useQueryClient();
	const status = useQuery({
		...orpc.system.redeployStatus.queryOptions(),
		refetchInterval: (query) => (query.state.data?.inProgress ? 1_500 : false),
	});
	const { isPending, mutate } = useMutation({
		...orpc.system.redeploy.mutationOptions(),
		onSuccess: async () => {
			localStorage.setItem("kowork-redeploy-requested-at", String(Date.now()));
			await queryClient.invalidateQueries({ queryKey: orpc.system.redeployStatus.key() });
			toast.success("Atualização iniciada. Acompanhe o progresso neste card.");
		},
		onError: (error) => {
			if (isRedeployConflict(error)) {
				toast.error("Já existe uma atualização em andamento");
				return;
			}

			toast.error("Não foi possível iniciar a atualização");
		},
	});

	useEffect(() => {
		const deployment = status.data;
		if (deployment?.state !== "succeeded" || !deployment.finishedAt) {
			return;
		}

		const requestedAt = Number(localStorage.getItem("kowork-redeploy-requested-at"));
		const appliedAt = Number(localStorage.getItem("kowork-redeploy-applied-at"));
		if (
			!requestedAt ||
			deployment.finishedAt < requestedAt ||
			appliedAt === deployment.finishedAt
		) {
			return;
		}

		localStorage.setItem("kowork-redeploy-applied-at", String(deployment.finishedAt));
		toast.success("Nova versão publicada. Atualizando o PWA...");
		void activateLatestPwa().catch(() => {
			localStorage.removeItem("kowork-redeploy-applied-at");
			toast.error("A versão foi publicada, mas o PWA não recarregou. Feche e abra o aplicativo.");
		});
	}, [status.data]);

	const deployment = status.data;
	const running = deployment?.inProgress || deployment?.state === "running";
	const failed = deployment?.state === "failed";
	const publishedMismatch = deployment?.state === "succeeded" && deployment.revisionMatch === false;
	const chipStatus =
		isPending || running
			? "running"
			: failed || publishedMismatch || status.isError
				? "error"
				: deployment?.state === "succeeded"
					? "done"
					: "idle";
	const statusMessage = isPending
		? "Pedindo ao servidor para iniciar a publicação."
		: running
			? (deployment?.message ?? "Preparando a publicação.")
			: failed
				? (deployment?.message ??
					"A atualização parou antes de concluir. Você pode tentar novamente.")
				: publishedMismatch
					? `A publicação terminou, mas a revisão instalada (${deployment.deployedRevision?.revision ?? "?"}) difere da solicitada (${deployment.commit?.slice(0, 12) ?? "?"}). Tente novamente.`
					: status.isError
						? "Não foi possível consultar o estado da atualização."
						: deployment?.state === "succeeded"
							? (deployment.message ?? "A última atualização foi concluída.")
							: "Nenhuma atualização em andamento.";
	const actionLabel = isPending
		? "Iniciando atualização"
		: running
			? "Atualização em andamento"
			: failed || publishedMismatch
				? "Tentar novamente"
				: "Atualizar aplicativo";

	return (
		<section
			className="overflow-hidden rounded-xl border border-border bg-card shadow-xs"
			aria-labelledby="update-title"
		>
			<div className="flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-start lg:justify-between">
				<div className="min-w-0 max-w-2xl">
					<Icon icon={RefreshCw} size="lg" className="mb-4" />
					<Title as="h2" id="update-title" size="xl" className="text-xl sm:text-2xl">
						Atualizar aplicativo
					</Title>
					<Text size="sm" tone="muted" className="mt-2 max-w-xl">
						Publique a versão mais recente deste computador para seus dispositivos. Os terminais
						continuam abertos e o aplicativo recarrega quando a nova versão estiver pronta.
					</Text>
				</div>
				<UpdateCallChip
					status={chipStatus}
					startedAt={running ? deployment?.startedAt : null}
					label={
						status.isPending
							? "Consultando status"
							: status.isError
								? "Status indisponível"
								: undefined
					}
					className="self-start lg:mt-1"
				/>
			</div>
			<div className="grid border-t border-border bg-muted/20 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
				<div className="min-w-0 px-5 py-4 sm:px-7">
					<Text size="xs" tone="faint" className="mb-1 font-semibold uppercase tracking-wide">
						Estado da publicação
					</Text>
					<Text size="sm" className="break-words" role="status" aria-live="polite">
						{statusMessage}
					</Text>
				</div>
				<div className="px-5 pb-5 sm:px-7 sm:py-4">
					<Button
						type="button"
						size="lg"
						disabled={!!running || isPending}
						onClick={() => mutate({})}
						className="h-11 w-full sm:w-auto"
					>
						{running || isPending ? (
							<RefreshCw className="size-4 animate-spin motion-reduce:animate-none" />
						) : failed || publishedMismatch ? (
							<RefreshCw className="size-4" />
						) : (
							<ArrowRight className="size-4" />
						)}
						{actionLabel}
					</Button>
				</div>
			</div>
		</section>
	);
}

function DevicesCard() {
	const navigate = useNavigate();
	const { devices } = useDevices();

	const pending = devices.filter((device) => device.status === "pending").length;

	return (
		<ConfigCard
			icon={MonitorSmartphone}
			title={pending > 0 ? `Dispositivos (${pending} aguardando)` : "Dispositivos"}
			description="Libere ou revogue cada aparelho que acessa o Kowork de fora."
			onClick={() => navigate({ to: "/dispositivos" })}
			className={pending > 0 ? "border-accent/60" : undefined}
		/>
	);
}

function ConfiguracoesPage() {
	const navigate = useNavigate();

	return (
		<PageShell
			title="Configurações"
			description="Personalize o aplicativo de acordo com suas preferências"
			icon={Settings}
			contentClassName="min-h-0 flex-1 overflow-y-auto px-4 pb-24 sm:pb-10"
		>
			<div className="mx-auto w-full max-w-5xl space-y-8 sm:space-y-10">
				<RedeployAppCard />

				<section className="space-y-4" aria-labelledby="preferences-title">
					<div>
						<Title as="h2" id="preferences-title" size="md">
							Preferências
						</Title>
						<Text size="sm" tone="muted" className="mt-1">
							Ajuste a aparência e os alertas deste aparelho.
						</Text>
					</div>
					<div className="grid gap-3 lg:grid-cols-2">
						<div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5">
							<div className="flex min-w-0 items-start gap-3">
								<Icon icon={Palette} size="sm" className="mt-0.5 shrink-0" />
								<div className="min-w-0 space-y-1">
									<Title as="h3" size="sm" className="text-sm font-semibold">
										Tema
									</Title>
									<Text size="sm" tone="muted">
										Escolha entre a aparência clara e a escura.
									</Text>
								</div>
							</div>
							<ThemeToggle
								className="size-11 shrink-0 rounded-lg border border-border bg-background transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
								iconClassName="size-4"
							/>
						</div>
						<PushNotificationsCard />
					</div>
				</section>

				<section className="space-y-4" aria-labelledby="access-title">
					<div>
						<Title as="h2" id="access-title" size="md">
							Acesso e manutenção
						</Title>
						<Text size="sm" tone="muted" className="mt-1">
							Gerencie dispositivos e processos abertos.
						</Text>
					</div>
					<div className="grid gap-3 lg:grid-cols-2">
						<DevicesCard />
						<ConfigCard
							icon={QrCode}
							title="Entrar pelo celular"
							description="Abra sua conta pelo QR, sem digitar usuário e senha."
							onClick={() => navigate({ to: "/parear" })}
						/>
						<ConfigCard
							icon={Brush}
							title="Encerrar invocações e agent-browser"
							description="Fecha terminais de invocação e navegadores do agent-browser, inclusive os que estiverem em uso."
							onClick={() => void sweepAllActiveTerminals()}
						/>
					</div>
				</section>
			</div>
		</PageShell>
	);
}
