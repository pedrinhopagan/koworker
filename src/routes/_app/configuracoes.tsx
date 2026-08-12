import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	Flag,
	MonitorSmartphone,
	Palette,
	QrCode,
	RefreshCw,
	Settings,
	SlidersHorizontal,
	Tags,
	Type,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";

import { orpc } from "@/client";
import { ConfigCard } from "@/components/settings/config-card";
import { PushNotificationsCard } from "@/components/settings/push-notifications-card";
import { CategoryManagerDrawer } from "@/components/tasks/CategoryManagerDrawer";
import { PriorityManagerDrawer } from "@/components/tasks/PriorityManagerDrawer";
import { Text, Title } from "@/components/typography";
import { Icon } from "@/components/ui/icon";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDevices } from "@/hooks/use-devices";
import { useManageDrawerStore } from "@/stores/manage-drawers";
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
	const [confirming, setConfirming] = useState(false);
	const queryClient = useQueryClient();
	const status = useQuery({
		...orpc.system.redeployStatus.queryOptions(),
		refetchInterval: (query) => (query.state.data?.inProgress ? 1_500 : false),
	});
	const { isPending, mutate } = useMutation({
		...orpc.system.redeploy.mutationOptions(),
		onSuccess: async () => {
			localStorage.setItem("kowork-redeploy-requested-at", String(Date.now()));
			setConfirming(false);
			await queryClient.invalidateQueries({ queryKey: orpc.system.redeployStatus.key() });
			toast.success("Atualização iniciada. Você pode acompanhar o progresso neste card.");
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
	const title = running
		? "Atualizando aplicativo"
		: failed
			? "Atualização falhou"
			: "Atualizar aplicativo";
	const description = running
		? (deployment?.message ?? "Preparando a publicação da main")
		: failed
			? (deployment.message ?? "Abra novamente para tentar outra vez")
			: deployment?.state === "succeeded" && deployment.commit
				? `Versão ${deployment.commit} publicada e verificada. Toque para buscar novas mudanças.`
				: "Busca a main mais recente, publica frontend e backend e atualiza este PWA.";

	return (
		<>
			<ConfigCard
				icon={RefreshCw}
				title={isPending ? "Iniciando atualização" : title}
				description={description}
				onClick={() => setConfirming(true)}
				disabled={!!running || isPending}
				className={
					running || isPending ? "border-primary/40" : failed ? "border-destructive/60" : undefined
				}
			/>

			<ConfirmDialog
				open={confirming}
				onClose={() => setConfirming(false)}
				onConfirm={() => mutate({})}
				title="Publicar a versão mais recente?"
				description="A VPS buscará origin/main, fará o build isolado, trocará frontend e backend de forma atômica e só então atualizará o PWA. O aplicativo pode ficar indisponível por alguns segundos."
				confirmLabel="Atualizar agora"
				loading={isPending}
			/>
		</>
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
	const openManageDrawer = useManageDrawerStore((s) => s.open);
	const navigate = useNavigate();

	return (
		<PageShell
			title="Configurações"
			description="Personalize o aplicativo de acordo com suas preferências"
			icon={Settings}
			contentClassName="min-h-0 flex-1 overflow-y-auto px-4 pb-8"
		>
			<div className="space-y-6">
				<section className="space-y-3">
					<Title as="h2" size="xs" className="text-muted-foreground uppercase tracking-wide">
						Execução
					</Title>
					<PushNotificationsCard />
				</section>

				<div className="border-t border-border" />

				<section className="space-y-3">
					<Title as="h2" size="xs" className="text-muted-foreground uppercase tracking-wide">
						Aparência
					</Title>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="flex items-start justify-between gap-4 border border-border bg-card p-4">
							<div className="flex items-start gap-3">
								<Icon icon={Palette} size="sm" className="mt-0.5" />
								<div className="space-y-1">
									<Title as="h3" size="sm" className="text-sm font-semibold">
										Tema
									</Title>
									<Text size="sm" tone="muted">
										Alterne entre tema claro e escuro.
									</Text>
								</div>
							</div>
							<ThemeToggle
								className="h-9 w-9 shrink-0 rounded-md border border-border bg-background hover:bg-muted transition-colors"
								iconClassName="h-4 w-4"
							/>
						</div>
						<ConfigCard
							icon={Type}
							title="Tipografia"
							description="Escolha a fonte da interface e a fonte de leitura de .md."
							onClick={() => navigate({ to: "/fontes" })}
						/>
					</div>
				</section>

				<div className="border-t border-border" />

				<section className="space-y-3">
					<Title as="h2" size="xs" className="text-muted-foreground uppercase tracking-wide">
						Tarefas
					</Title>
					<div className="grid gap-4 sm:grid-cols-2">
						<ConfigCard
							icon={Tags}
							title="Gerenciar categorias"
							description="Gerencie categorias para organizar tarefas."
							onClick={() => openManageDrawer("categories")}
						/>
						<ConfigCard
							icon={Flag}
							title="Gerenciar prioridades"
							description="Ajuste os níveis de prioridade e a ordem exibida."
							onClick={() => openManageDrawer("priorities")}
						/>
					</div>
				</section>

				<div className="border-t border-border" />

				<section className="space-y-3">
					<Title as="h2" size="xs" className="text-muted-foreground uppercase tracking-wide">
						Sistema
					</Title>
					<div className="grid gap-4 sm:grid-cols-2">
						<ConfigCard
							icon={SlidersHorizontal}
							title="Terminal e fontes"
							description="Emulador, multiplexador, pasta base e fontes de agents/skills."
							onClick={() => navigate({ to: "/sistema" })}
						/>
						<DevicesCard />
						<ConfigCard
							icon={QrCode}
							title="Entrar pelo celular"
							description="Abra sua conta pelo QR, sem digitar usuário e senha."
							onClick={() => navigate({ to: "/parear" })}
						/>
						<RedeployAppCard />
					</div>
				</section>
			</div>

			<CategoryManagerDrawer />
			<PriorityManagerDrawer />
		</PageShell>
	);
}
