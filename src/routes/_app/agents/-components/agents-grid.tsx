import { Link, useNavigate } from "@tanstack/react-router";
import { Search, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";

import { DocEntityContextMenu } from "@/components/doc-entity-context-menu";
import { PrinciplesFindings } from "@/components/principles/principles-findings";
import { Text } from "@/components/typography";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { AGENT_TOOL_LABEL } from "@/constants/agents";
import { useDocEntityPin } from "@/hooks/use-doc-entity-pin";
import { openFolderInOs, shareFolderAsZip } from "@/lib/os-share";
import { lintPrinciples } from "@/lib/principles/lint";
import { LucideIcon } from "@/lib/lucide-icon";
import { cn } from "@/lib/utils";
import type { TaskAgent } from "@/types/agents";
import { AgentAppearanceDialog } from "./agent-appearance-dialog";
import { AgentCreateTile } from "./agent-create-tile";

function distinctTools(agent: TaskAgent): TaskAgent["sources"][number]["tool"][] {
	return [...new Set(agent.sources.map((source) => source.tool))];
}

type AgentsGridProps = {
	agents: TaskAgent[];
	loading: boolean;
};

export function AgentsGrid({ agents, loading }: AgentsGridProps) {
	const [search, setSearch] = useState("");
	const [appearanceSlug, setAppearanceSlug] = useState<string | null>(null);

	const filtered = useMemo(() => {
		const term = search.trim().toLowerCase();
		if (!term) return agents;
		return agents.filter(
			(agent) =>
				agent.label.toLowerCase().includes(term) ||
				agent.slug.toLowerCase().includes(term) ||
				agent.description.toLowerCase().includes(term),
		);
	}, [agents, search]);

	// Deriva o agent vivo de `agents` (não um snapshot): ao trocar ícone/cor a mutation invalida a
	// query, `agents` se atualiza e o preview do dialog reflete a mudança em tempo real.
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
					<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
						<AgentCreateTile />
						{filtered.map((agent, index) => (
							<AgentTile
								key={agent.slug}
								agent={agent}
								index={index}
								onAppearance={() => setAppearanceSlug(agent.slug)}
							/>
						))}
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
	onAppearance: () => void;
};

function AgentTile({ agent, index, onAppearance }: AgentTileProps) {
	const navigate = useNavigate();
	const findings = useMemo(
		() =>
			lintPrinciples({
				kind: "agent",
				slug: agent.slug,
				name: agent.label,
				description: agent.description,
				body: agent.instructions,
				metadata: agent.metadata,
			}),
		[agent.slug, agent.label, agent.description, agent.instructions, agent.metadata],
	);

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
	// link). Só os controles próprios (aparência, findings) reativam o ponteiro. Igual ao TaskItem.
	return (
		<DocEntityContextMenu
			label={agent.label}
			pinned={pinned}
			actions={{
				onTogglePin: togglePin,
				onOpen: () => navigate({ to: "/agents/$slug", params: { slug: agent.slug } }),
				onOpenInOs: () => void openFolderInOs(agent.primaryDir),
				onShareZip: () => void shareFolderAsZip(agent.primaryDir),
				onAppearance,
			}}
		>
			<div
				className={cn(
					"group relative flex min-w-0 flex-col p-4",
					"border border-border border-t-2 bg-card transition-colors",
					"hover:bg-secondary/50",
					"animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both",
				)}
				style={{ borderTopColor: agent.color, animationDelay: `${Math.min(index, 12) * 35}ms` }}
			>
				<Link
					to="/agents/$slug"
					params={{ slug: agent.slug }}
					aria-label={agent.label}
					className="absolute inset-0 z-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
				/>

				<button
					type="button"
					onClick={onAppearance}
					title="Aparência"
					aria-label="Editar aparência"
					className="absolute right-2 top-2 z-10 flex size-7 items-center justify-center border border-transparent text-muted-foreground opacity-0 transition-all hover:border-border hover:bg-background hover:text-foreground group-hover:opacity-100"
				>
					<SlidersHorizontal className="size-3.5" />
				</button>

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
							<PrinciplesFindings findings={findings} />
						</span>
					</div>
				</div>
			</div>
		</DocEntityContextMenu>
	);
}
