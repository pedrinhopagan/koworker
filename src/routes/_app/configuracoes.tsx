import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Flag, FolderTree, Palette, Settings, Tags, Type } from "lucide-react";

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
	const navigate = useNavigate();

	return (
		<PageShell
			title="Configurações"
			description="Personalize o aplicativo de acordo com suas preferências"
			icon={Settings}
		>
			<div className="space-y-6">
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
							id="tipografia"
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
							id="categorias"
							icon={Tags}
							title="Gerenciar categorias"
							description="Gerencie categorias para organizar tarefas."
							onClick={() => openManageDrawer("categories")}
						/>
						<ConfigCard
							id="prioridades"
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
						Skills
					</Title>
					<div className="grid gap-4 sm:grid-cols-2">
						<ConfigCard
							id="fontes-skills"
							icon={FolderTree}
							title="Fontes de skills"
							description="Pastas extras de onde ler skills."
							onClick={() => navigate({ to: "/fontes-skills" })}
						/>
					</div>
				</section>
			</div>

			<CategoryManagerDrawer />
			<PriorityManagerDrawer />
		</PageShell>
	);
}
