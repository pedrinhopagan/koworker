import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Search, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PrinciplesFindings } from "@/components/principles/principles-findings";
import { Text } from "@/components/typography";
import { Chip } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CustomSelect } from "@/components/ui/custom-select";
import { Input } from "@/components/ui/input";
import { AGENT_TOOL_LABEL } from "@/constants/agents";
import { useDocEntityPin } from "@/hooks/use-doc-entity-pin";
import { copyToClipboard } from "@/lib/build-prompt";
import { openFolderInOs } from "@/lib/os-share";
import { LucideIcon } from "@/lib/lucide-icon";
import { cn } from "@/lib/utils";
import type { AgentCategory, TaskAgent } from "@/types/agents";
import { useAgentMutations } from "../-utils/use-agent-mutations";
import { AgentAppearanceDialog } from "./agent-appearance-dialog";
import { AgentCategoryCreateButton, AgentCategoryHeader } from "./agent-categories-controls";
import { AgentCreateTile } from "./agent-create-tile";
import { AgentSettingsMenu } from "./agent-settings-menu";

const NO_CATEGORY_KEY = "__none__";

function distinctTools(agent: TaskAgent): TaskAgent["sources"][number]["tool"][] {
	return [...new Set(agent.sources.map((source) => source.tool))];
}

async function copyAgentPath(path: string) {
	const copied = await copyToClipboard(path);
	toast[copied ? "success" : "error"](copied ? "Caminho copiado" : "Falha ao copiar caminho");
}

type AgentsGridProps = {
	agents: TaskAgent[];
	categories: AgentCategory[];
	loading: boolean;
};

export function AgentsGrid({ agents, categories, loading }: AgentsGridProps) {
	const [search, setSearch] = useState("");
	const [categoryFilter, setCategoryFilter] = useState<string>("all");
	const [appearanceSlug, setAppearanceSlug] = useState<string | null>(null);
	const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

	const isOrphan = (agent: TaskAgent) =>
		!agent.categoryId || !categories.some((category) => category.id === agent.categoryId);

	const filtered = useMemo(() => {
		const term = search.trim().toLowerCase();
		return agents.filter((agent) => {
			if (categoryFilter === NO_CATEGORY_KEY && !isOrphan(agent)) return false;
			if (
				categoryFilter !== "all" &&
				categoryFilter !== NO_CATEGORY_KEY &&
				agent.categoryId !== categoryFilter
			) {
				return false;
			}
			if (!term) return true;
			return (
				agent.label.toLowerCase().includes(term) ||
				agent.slug.toLowerCase().includes(term) ||
				agent.description.toLowerCase().includes(term)
			);
		});
	}, [agents, categories, search, categoryFilter]);

	// Seções: categorias nomeadas (já na ordem do banco — getAll ordena por display_order). Sem
	// busca/filtro elas aparecem todas, mesmo vazias (a estrutura serve pra organizar); com filtro
	// ativo, as vazias somem pra não virar uma parede de cabeçalhos por poucos resultados. "Sem
	// categoria" só entra quando tem agent. Os agents já vêm filtrados.
	const sections = useMemo(() => {
		const byCategory = new Map<string, TaskAgent[]>();
		const orphans: TaskAgent[] = [];
		for (const agent of filtered) {
			if (agent.categoryId && categories.some((category) => category.id === agent.categoryId)) {
				const bucket = byCategory.get(agent.categoryId);
				if (bucket) {
					bucket.push(agent);
				} else {
					byCategory.set(agent.categoryId, [agent]);
				}
			} else {
				orphans.push(agent);
			}
		}

		const filtering = search.trim().length > 0 || categoryFilter !== "all";
		const named: {
			key: string;
			category?: AgentCategory;
			agents: TaskAgent[];
		}[] = categories
			.filter((category) => !filtering || (byCategory.get(category.id)?.length ?? 0) > 0)
			.map((category) => ({
				key: category.id,
				category,
				agents: byCategory.get(category.id) ?? [],
			}));

		if (orphans.length > 0) {
			named.push({ key: NO_CATEGORY_KEY, agents: orphans });
		}
		return named;
	}, [filtered, categories, search, categoryFilter]);

	// Opções do filtro de categoria: "Todas" + categorias (com contagem) + "Sem categoria" quando há
	// órfãs. A contagem usa o total por categoria (não o filtrado) pra servir de visão geral estável.
	const filterOptions = useMemo(() => {
		const counts = new Map<string, number>();
		let orphanCount = 0;
		for (const agent of agents) {
			if (isOrphan(agent)) {
				orphanCount += 1;
			} else {
				counts.set(agent.categoryId!, (counts.get(agent.categoryId!) ?? 0) + 1);
			}
		}

		const options: {
			id: string;
			name: string;
			color?: string;
			count: number;
		}[] = [
			{ id: "all", name: "Todas", count: agents.length },
			...categories.map((category) => ({
				id: category.id,
				name: category.name,
				color: category.color,
				count: counts.get(category.id) ?? 0,
			})),
		];

		if (orphanCount > 0) {
			options.push({
				id: NO_CATEGORY_KEY,
				name: "Sem categoria",
				count: orphanCount,
			});
		}
		return options;
	}, [agents, categories]);

	const selectedOption =
		filterOptions.find((option) => option.id === categoryFilter) ?? filterOptions[0];

	function toggleCollapsed(key: string) {
		setCollapsed((prev) => {
			const next = new Set(prev);
			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}
			return next;
		});
	}

	// Deriva o agent vivo de `agents` (não um snapshot): ao trocar ícone/cor/categoria a mutation
	// invalida a query, `agents` se atualiza e o preview do dialog reflete a mudança em tempo real.
	const appearanceAgent = appearanceSlug
		? (agents.find((agent) => agent.slug === appearanceSlug) ?? null)
		: null;

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex flex-wrap items-center gap-3 pb-4">
				<div className="relative min-w-[240px] flex-1">
					<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						type="search"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Buscar agent por nome, slug ou descrição"
						className="w-full pl-9 font-mono"
					/>
				</div>
				<CustomSelect
					items={filterOptions}
					value={categoryFilter}
					onValueChange={(value) => setCategoryFilter(value)}
					className="w-56 flex-none"
					renderTrigger={() => (
						<>
							<span className="flex min-w-0 flex-1 items-center gap-2 text-left">
								<span
									className="size-2 shrink-0 rounded-full"
									style={{
										backgroundColor: selectedOption?.color ?? "var(--muted-foreground)",
									}}
								/>
								<span className="truncate">{selectedOption?.name ?? "Todas"}</span>
								<Chip size="xs" variant="ghost" className="ml-auto font-mono tabular-nums">
									{selectedOption?.count ?? 0}
								</Chip>
							</span>
							<ChevronDown className="size-4 shrink-0 opacity-50" />
						</>
					)}
					renderItem={(option) => (
						<div className="flex w-full items-center gap-2">
							<span
								className="size-2 shrink-0 rounded-full"
								style={{
									backgroundColor: option.color ?? "var(--muted-foreground)",
								}}
							/>
							<span className="truncate">{option.name}</span>
							<span className="ml-auto font-mono text-[11px] tabular-nums opacity-60">
								{option.count}
							</span>
						</div>
					)}
				/>
				<AgentCategoryCreateButton categories={categories} />
				<Text size="xs" tone="muted" className="ml-auto min-w-12 text-right font-mono tabular-nums">
					{filtered.length}/{agents.length}
				</Text>
			</div>

			{loading && (
				<Text size="sm" tone="muted">
					Carregando agents...
				</Text>
			)}

			{!loading && (
				<div className="min-h-0 flex-1 transform-gpu overflow-y-auto overscroll-contain pr-1">
					<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pb-5">
						<AgentCreateTile />
					</div>

					<div className="flex flex-col gap-5">
						{sections.map(({ key, category, agents: sectionAgents }) => {
							const isCollapsed = collapsed.has(key);
							return (
								<section key={key} className="flex flex-col gap-2">
									<AgentCategoryHeader
										category={category}
										count={sectionAgents.length}
										collapsed={isCollapsed}
										onToggleCollapse={() => toggleCollapsed(key)}
									/>

									{!isCollapsed && (
										<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
											{sectionAgents.map((agent, index) => (
												<AgentTile
													key={agent.slug}
													agent={agent}
													index={index}
													categories={categories}
													onAppearance={() => setAppearanceSlug(agent.slug)}
												/>
											))}
											{sectionAgents.length === 0 && (
												<Text size="sm" tone="muted" className="px-1 py-2">
													Nenhum agent nesta categoria.
												</Text>
											)}
										</div>
									)}
								</section>
							);
						})}
					</div>

					{agents.length > 0 && filtered.length === 0 && (
						<Text size="sm" tone="muted" className="pt-3">
							Nenhum agent corresponde aos filtros
						</Text>
					)}
				</div>
			)}

			<AgentAppearanceDialog agent={appearanceAgent} onClose={() => setAppearanceSlug(null)} />
		</div>
	);
}

type AgentTileProps = {
	agent: TaskAgent;
	index: number;
	categories: AgentCategory[];
	onAppearance: () => void;
};

function AgentTile({ agent, index, categories, onAppearance }: AgentTileProps) {
	const navigate = useNavigate();
	const [menuOpen, setMenuOpen] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const { removeAllAgent, removing } = useAgentMutations();

	const { pinned, togglePin } = useDocEntityPin({
		kind: "agent",
		primaryPath: agent.primaryPath,
		meta: {
			title: agent.label,
			icon: agent.icon,
			iconColor: agent.color,
			nav: { to: "/agents/$slug", params: { slug: agent.slug } },
		},
	});

	// Link absoluto inset-0 navega; o conteúdo é pointer-events-none acima dele (clique no corpo cai no
	// link). Só os controles próprios (menu, findings) reativam o ponteiro. Igual ao TaskItem. O botão
	// abre o menu no clique esquerdo; o clique direito no card abre o mesmo menu, ancorado no botão.
	return (
		<>
			<div
				className={cn(
					"group relative flex min-w-0 flex-col p-4",
					"border border-border border-t-2 bg-card transition-colors",
					"hover:bg-secondary/50",
					"animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both",
				)}
				style={{
					borderTopColor: agent.color,
					animationDelay: `${Math.min(index, 12) * 35}ms`,
				}}
				onContextMenu={(event) => {
					event.preventDefault();
				}}
				onPointerUp={(event) => {
					if (event.button === 2) {
						setMenuOpen(true);
					}
				}}
			>
				<Link
					to="/agents/$slug"
					params={{ slug: agent.slug }}
					aria-label={agent.label}
					className="absolute inset-0 z-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
				/>

				<AgentSettingsMenu
					agent={agent}
					categories={categories}
					onAppearance={onAppearance}
					open={menuOpen}
					onOpenChange={setMenuOpen}
					docActions={{
						pinned,
						onTogglePin: togglePin,
						onOpen: () => navigate({ to: "/agents/$slug", params: { slug: agent.slug } }),
						onOpenInOs: () => void openFolderInOs(agent.primaryDir),
						onCopyPath: () => void copyAgentPath(agent.primaryPath),
						onDelete: () => setConfirmDelete(true),
					}}
					trigger={
						<button
							type="button"
							aria-label="Ações do agent"
							title="Ações do agent"
							className="absolute right-2 top-2 z-10 flex size-7 items-center justify-center border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-background hover:text-foreground data-[state=open]:border-border data-[state=open]:bg-background"
						>
							<SlidersHorizontal className="size-3.5" />
						</button>
					}
				/>

				<div className="pointer-events-none relative z-10 flex flex-col gap-3">
					<div className="flex items-center gap-3">
						<div
							className="flex h-10 w-10 shrink-0 items-center justify-center border bg-muted/30 transition-colors group-hover:bg-muted/60"
							style={{ borderColor: agent.color, color: agent.color }}
						>
							<LucideIcon name={agent.icon} className="size-5" />
						</div>
						<div className="min-w-0 flex-1">
							<div className="truncate font-display text-sm font-semibold leading-tight">
								{agent.label}
							</div>
							<div className="truncate font-mono text-[11px] text-muted-foreground">
								{agent.slug}
							</div>
						</div>
					</div>

					<p className="line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-muted-foreground">
						{agent.description}
					</p>

					<div className="flex flex-wrap items-center gap-1">
						{distinctTools(agent).map((tool) => (
							<Chip key={tool} size="xs" variant="ghost">
								{AGENT_TOOL_LABEL[tool]}
							</Chip>
						))}
						{agent.conflict && (
							<Chip size="xs" variant="destructive" className="gap-1">
								<TriangleAlert className="size-3" />
								conflito
							</Chip>
						)}
						<span className="pointer-events-auto">
							<PrinciplesFindings findings={agent.findings} />
						</span>
					</div>
				</div>
			</div>
			<ConfirmDialog
				open={confirmDelete}
				onClose={() => setConfirmDelete(false)}
				onConfirm={() => removeAllAgent({ slug: agent.slug }, () => setConfirmDelete(false))}
				title={`Deletar o agent "${agent.label}"?`}
				description="O agent será removido de todos os projetos e fontes configuradas. Antes disso, uma cópia de cada arquivo será salva em ~/Documentos/backups/koworker/agents/."
				confirmLabel="Deletar"
				variant="danger"
				loading={removing}
			/>
		</>
	);
}
