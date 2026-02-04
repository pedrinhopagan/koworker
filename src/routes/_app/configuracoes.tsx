import { createFileRoute } from "@tanstack/react-router";
import { Bell, Flag, Keyboard, Palette, Settings, Shield, Tags } from "lucide-react";
import { toast } from "sonner";

import { ConfigCard } from "@/components/settings/config-card";
import { CategoryManagerDrawer } from "@/components/tasks/CategoryManagerDrawer";
import { PriorityManagerDrawer } from "@/components/tasks/PriorityManagerDrawer";
import { Text, Title } from "@/components/typography";
import { Icon } from "@/components/ui/icon";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useManageDrawerStore } from "@/stores/manage-drawers";
import { PageShell } from "../../components/layout/page-shell";

export const Route = createFileRoute("/_app/configuracoes")({
	component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
	const openManageDrawer = useManageDrawerStore((s) => s.open);
	const cards = [
		{
			id: "categorias",
			icon: Tags,
			title: "Tipos de tarefa",
			description: "Gerencie categorias para organizar tarefas.",
			onClick: () => openManageDrawer("categories"),
		},
		{
			id: "prioridades",
			icon: Flag,
			title: "Prioridades",
			description: "Ajuste os níveis de prioridade e a ordem exibida.",
			onClick: () => openManageDrawer("priorities"),
		},
		{
			id: "atalhos",
			icon: Keyboard,
			title: "Atalhos de teclado",
			description: "Personalize combinações de teclas e ações rápidas.",
			onClick: () => toast.message("Atalhos personalizáveis em breve."),
		},
		{
			id: "notificacoes",
			icon: Bell,
			title: "Notificações",
			description: "Gerencie alertas e lembretes importantes.",
			onClick: () => toast.message("Configurações de notificações em breve."),
		},
		{
			id: "privacidade",
			icon: Shield,
			title: "Privacidade",
			description: "Controle permissões e dados armazenados.",
			onClick: () => toast.message("Controles de privacidade em breve."),
		},
	];

	return (
		<PageShell
			title="Configurações"
			description="Personalize o aplicativo de acordo com suas preferências"
			icon={Settings}
		>
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="flex items-start justify-between gap-4 border border-border bg-card p-4">
					<div className="flex items-start gap-3">
						<Icon icon={Palette} size="sm" className="mt-0.5" />
						<div className="space-y-1">
							<Title as="h3" size="sm" className="text-sm font-semibold">
								Aparência
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
				{cards.map((card) => (
					<ConfigCard key={card.id} {...card} />
				))}
			</div>

			<CategoryManagerDrawer />
			<PriorityManagerDrawer />
		</PageShell>
	);
}
