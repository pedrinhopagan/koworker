import { Link } from "@tanstack/react-router";
import { Search, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";

import { Text } from "@/components/typography";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { SKILL_TOOL_LABEL } from "@/constants/skills";
import { LucideIcon } from "@/lib/lucide-icon";
import { cn } from "@/lib/utils";
import type { TaskSkill } from "@/types/skills";
import { SkillAppearanceDialog } from "./skill-appearance-dialog";

type SourceFilter = "all" | "builtin" | "custom";

const SOURCE_FILTERS: { value: SourceFilter; label: string }[] = [
	{ value: "all", label: "Todas" },
	{ value: "builtin", label: "Koworker" },
	{ value: "custom", label: "Personalizadas" },
];

function distinctTools(skill: TaskSkill): TaskSkill["sources"][number]["tool"][] {
	return [...new Set(skill.sources.map((source) => source.tool))];
}

type SkillsGridProps = {
	skills: TaskSkill[];
	loading: boolean;
};

export function SkillsGrid({ skills, loading }: SkillsGridProps) {
	const [search, setSearch] = useState("");
	const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
	const [appearanceSkill, setAppearanceSkill] = useState<TaskSkill | null>(null);

	const filtered = useMemo(() => {
		const term = search.trim().toLowerCase();
		return skills.filter((skill) => {
			if (sourceFilter !== "all" && skill.source !== sourceFilter) return false;
			if (!term) return true;
			return (
				skill.label.toLowerCase().includes(term) ||
				skill.slug.toLowerCase().includes(term) ||
				skill.description.toLowerCase().includes(term)
			);
		});
	}, [skills, search, sourceFilter]);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex flex-wrap items-center gap-3 pb-4">
				<div className="relative min-w-[240px] flex-1">
					<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						type="search"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Buscar skill por nome, slug ou descrição"
						className="w-full pl-9 font-mono"
					/>
				</div>
				<div className="flex gap-1">
					{SOURCE_FILTERS.map((filter) => (
						<button
							key={filter.value}
							type="button"
							onClick={() => setSourceFilter(filter.value)}
							className="cursor-pointer"
						>
							<Chip size="md" variant={sourceFilter === filter.value ? "primary" : "outline"}>
								{filter.label}
							</Chip>
						</button>
					))}
				</div>
				<Text size="xs" tone="muted" className="ml-auto min-w-12 text-right font-mono tabular-nums">
					{filtered.length}/{skills.length}
				</Text>
			</div>

			{loading && (
				<Text size="sm" tone="muted">
					Carregando skills...
				</Text>
			)}

			{!loading && skills.length === 0 && (
				<Text size="sm" tone="muted">
					Nenhuma skill encontrada nas pastas de configuração
				</Text>
			)}

			{!loading && skills.length > 0 && filtered.length === 0 && (
				<Text size="sm" tone="muted">
					Nenhuma skill corresponde aos filtros
				</Text>
			)}

			{!loading && filtered.length > 0 && (
				<div className="min-h-0 flex-1 transform-gpu overflow-y-auto overscroll-contain pr-1">
					<div className="grid grid-cols-3 lg:grid-cols-4 gap-3">
						{filtered.map((skill, index) => (
							<SkillTile
								key={skill.slug}
								skill={skill}
								index={index}
								onAppearance={() => setAppearanceSkill(skill)}
							/>
						))}
					</div>
				</div>
			)}

			<SkillAppearanceDialog skill={appearanceSkill} onClose={() => setAppearanceSkill(null)} />
		</div>
	);
}

type SkillTileProps = {
	skill: TaskSkill;
	index: number;
	onAppearance: () => void;
};

function SkillTile({ skill, index, onAppearance }: SkillTileProps) {
	return (
		<Link
			to="/skills/$slug"
			params={{ slug: skill.slug }}
			className={cn(
				"group relative flex min-w-0 flex-col gap-3 p-4",
				"border border-border border-t-2 bg-card transition-colors",
				"hover:bg-secondary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
				"animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both",
			)}
			style={{ borderTopColor: skill.color, animationDelay: `${Math.min(index, 12) * 35}ms` }}
		>
			<button
				type="button"
				onClick={(event) => {
					event.preventDefault();
					event.stopPropagation();
					onAppearance();
				}}
				title="Aparência"
				aria-label="Editar aparência"
				className="absolute right-2 top-2 flex size-7 items-center justify-center border border-transparent text-muted-foreground opacity-0 transition-all hover:border-border hover:bg-background hover:text-foreground group-hover:opacity-100"
			>
				<SlidersHorizontal className="size-3.5" />
			</button>

			<div className="flex items-center gap-3">
				<div
					className="flex h-10 w-10 shrink-0 items-center justify-center border bg-muted/30 transition-colors group-hover:bg-muted/60"
					style={{ borderColor: skill.color, color: skill.color }}
				>
					<LucideIcon name={skill.icon} className="size-5" />
				</div>
				<div className="min-w-0 flex-1">
					<div className="truncate font-display text-sm font-semibold leading-tight">
						{skill.label}
					</div>
					<div className="truncate font-mono text-[11px] text-muted-foreground">{skill.slug}</div>
				</div>
			</div>

			<p className="line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-muted-foreground">
				{skill.description}
			</p>

			<div className="flex flex-wrap items-center gap-1">
				<Chip size="xs" variant={skill.source === "builtin" ? "primary" : "outline"}>
					{skill.source === "builtin" ? "Koworker" : "Personalizada"}
				</Chip>
				{distinctTools(skill).map((tool) => (
					<Chip key={tool} size="xs" variant="ghost">
						{SKILL_TOOL_LABEL[tool]}
					</Chip>
				))}
				{skill.conflict && (
					<Chip size="xs" variant="destructive" className="gap-1">
						<TriangleAlert className="size-3" />
						conflito
					</Chip>
				)}
			</div>
		</Link>
	);
}
