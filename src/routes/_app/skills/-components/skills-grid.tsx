import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { Text } from "@/components/typography";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { LucideIcon } from "@/lib/lucide-icon";
import { cn } from "@/lib/utils";
import type { TaskSkill } from "@/types/skills";

type SourceFilter = "all" | "builtin" | "custom";

const SOURCE_FILTERS: { value: SourceFilter; label: string }[] = [
	{ value: "all", label: "Todas" },
	{ value: "builtin", label: "Koworker" },
	{ value: "custom", label: "Personalizadas" },
];

type SkillsGridProps = {
	skills: TaskSkill[];
	loading: boolean;
	onView: (slug: string) => void;
	onEdit: (slug: string) => void;
};

export function SkillsGrid({ skills, loading, onView, onEdit }: SkillsGridProps) {
	const [search, setSearch] = useState("");
	const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

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
					<div className="flex flex-wrap gap-3 content-start">
						{filtered.map((skill, index) => (
							<SkillTile
								key={skill.slug}
								skill={skill}
								index={index}
								onView={() => onView(skill.slug)}
								onEdit={() => onEdit(skill.slug)}
							/>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

type SkillTileProps = {
	skill: TaskSkill;
	index: number;
	onView: () => void;
	onEdit: () => void;
};

function SkillTile({ skill, index, onView, onEdit }: SkillTileProps) {
	return (
		<div
			className={cn(
				"group relative flex min-w-0 max-w-[420px] grow basis-[300px] flex-col",
				"border border-border border-t-2 bg-card",
				"animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both",
			)}
			style={{ borderTopColor: skill.color, animationDelay: `${Math.min(index, 12) * 35}ms` }}
		>
			<button
				type="button"
				onClick={onView}
				className="flex flex-1 cursor-pointer flex-col gap-3 p-4 text-left transition-colors hover:bg-secondary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				aria-label={`Ver ${skill.label}`}
			>
				<div className="flex items-center gap-3">
					<div
						className="flex h-10 w-10 shrink-0 items-center justify-center border bg-muted/30"
						style={{ borderColor: skill.color, color: skill.color }}
					>
						<LucideIcon name={skill.icon} className="size-5" />
					</div>
					<div className="min-w-0 flex-1">
						<div className="truncate font-display text-sm font-semibold">{skill.label}</div>
						<div className="truncate font-mono text-[11px] text-muted-foreground">{skill.slug}</div>
					</div>
				</div>

				<p className="line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-muted-foreground">
					{skill.description}
				</p>

				<div className="flex flex-wrap gap-1">
					<Chip size="xs" variant={skill.source === "builtin" ? "primary" : "outline"}>
						{skill.source === "builtin" ? "Koworker" : "Personalizada"}
					</Chip>
					{skill.sources.some((source) => source.scope === "project") && (
						<Chip size="xs" variant="ghost">
							projeto
						</Chip>
					)}
				</div>
			</button>

			<button
				type="button"
				onClick={onEdit}
				aria-label={`Editar aparência de ${skill.label}`}
				className={cn(
					"absolute right-2 top-2 flex h-7 w-7 cursor-pointer items-center justify-center border border-transparent text-muted-foreground",
					"opacity-0 transition-opacity group-hover:opacity-100 hover:border-border hover:bg-background hover:text-foreground",
					"focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
				)}
			>
				<SlidersHorizontal className="size-3.5" />
			</button>
		</div>
	);
}
