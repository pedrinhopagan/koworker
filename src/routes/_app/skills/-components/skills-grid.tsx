import { Link } from "@tanstack/react-router";
import { ChevronDown, Search, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";

import { PrinciplesFindings } from "@/components/principles/principles-findings";
import { Text } from "@/components/typography";
import { Chip } from "@/components/ui/chip";
import { CustomSelect } from "@/components/ui/custom-select";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { SKILL_TOOL_LABEL } from "@/constants/skills";
import { lintPrinciples } from "@/lib/principles/lint";
import { LucideIcon } from "@/lib/lucide-icon";
import { cn } from "@/lib/utils";
import type { SkillCategory, TaskSkill } from "@/types/skills";
import { SkillAppearanceDialog } from "./skill-appearance-dialog";
import { SkillCategoryCreateButton, SkillCategoryHeader } from "./skill-categories-controls";
import { SkillCreateTile } from "./skill-create-tile";

// Pseudo-id da seção/filtro "Sem categoria"; nenhuma categoria real usa essa string.
const NO_CATEGORY_KEY = "__none__";

function distinctTools(skill: TaskSkill): TaskSkill["sources"][number]["tool"][] {
	return [...new Set(skill.sources.map((source) => source.tool))];
}

type SkillsGridProps = {
	skills: TaskSkill[];
	categories: SkillCategory[];
	loading: boolean;
};

export function SkillsGrid({ skills, categories, loading }: SkillsGridProps) {
	const [search, setSearch] = useState("");
	const [categoryFilter, setCategoryFilter] = useState<string>("all");
	const [appearanceSlug, setAppearanceSlug] = useState<string | null>(null);
	const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

	const isOrphan = (skill: TaskSkill) =>
		!skill.categoryId || !categories.some((category) => category.id === skill.categoryId);

	const filtered = useMemo(() => {
		const term = search.trim().toLowerCase();
		return skills.filter((skill) => {
			if (categoryFilter === NO_CATEGORY_KEY && !isOrphan(skill)) return false;
			if (
				categoryFilter !== "all" &&
				categoryFilter !== NO_CATEGORY_KEY &&
				skill.categoryId !== categoryFilter
			) {
				return false;
			}
			if (!term) return true;
			return (
				skill.label.toLowerCase().includes(term) ||
				skill.slug.toLowerCase().includes(term) ||
				skill.description.toLowerCase().includes(term)
			);
		});
	}, [skills, categories, search, categoryFilter]);

	// Seções: categorias nomeadas (já na ordem do banco — getAll ordena por display_order). Sem
	// busca/filtro elas aparecem todas, mesmo vazias (a estrutura serve pra organizar); com filtro
	// ativo, as vazias somem pra não virar uma parede de cabeçalhos por poucos resultados. "Sem
	// categoria" só entra quando tem skill. As skills já vêm filtradas.
	const sections = useMemo(() => {
		const byCategory = new Map<string, TaskSkill[]>();
		const orphans: TaskSkill[] = [];
		for (const skill of filtered) {
			if (skill.categoryId && categories.some((category) => category.id === skill.categoryId)) {
				const bucket = byCategory.get(skill.categoryId);
				if (bucket) {
					bucket.push(skill);
				} else {
					byCategory.set(skill.categoryId, [skill]);
				}
			} else {
				orphans.push(skill);
			}
		}

		const filtering = search.trim().length > 0 || categoryFilter !== "all";
		const named: { key: string; category?: SkillCategory; skills: TaskSkill[] }[] = categories
			.filter((category) => !filtering || (byCategory.get(category.id)?.length ?? 0) > 0)
			.map((category) => ({
				key: category.id,
				category,
				skills: byCategory.get(category.id) ?? [],
			}));

		if (orphans.length > 0) {
			named.push({ key: NO_CATEGORY_KEY, skills: orphans });
		}
		return named;
	}, [filtered, categories, search, categoryFilter]);

	// Opções do filtro de categoria: "Todas" + categorias (com contagem) + "Sem categoria" quando há
	// órfãs. A contagem usa o total por categoria (não o filtrado) pra servir de visão geral estável.
	const filterOptions = useMemo(() => {
		const counts = new Map<string, number>();
		let orphanCount = 0;
		for (const skill of skills) {
			if (isOrphan(skill)) {
				orphanCount += 1;
			} else {
				counts.set(skill.categoryId!, (counts.get(skill.categoryId!) ?? 0) + 1);
			}
		}

		const options: { id: string; name: string; color?: string; count: number }[] = [
			{ id: "all", name: "Todas", count: skills.length },
			...categories.map((category) => ({
				id: category.id,
				name: category.name,
				color: category.color,
				count: counts.get(category.id) ?? 0,
			})),
		];

		if (orphanCount > 0) {
			options.push({ id: NO_CATEGORY_KEY, name: "Sem categoria", count: orphanCount });
		}
		return options;
	}, [skills, categories]);

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

	// Deriva a skill viva de `skills` (não um snapshot): ao trocar ícone/cor/categoria a mutation
	// invalida a query, `skills` se atualiza e o preview do dialog reflete a mudança em tempo real.
	const appearanceSkill = appearanceSlug
		? (skills.find((skill) => skill.slug === appearanceSlug) ?? null)
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
						placeholder="Buscar skill por nome, slug ou descrição"
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
									style={{ backgroundColor: selectedOption?.color ?? "var(--muted-foreground)" }}
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
								style={{ backgroundColor: option.color ?? "var(--muted-foreground)" }}
							/>
							<span className="truncate">{option.name}</span>
							<span className="ml-auto font-mono text-[11px] tabular-nums opacity-60">
								{option.count}
							</span>
						</div>
					)}
				/>
				<SkillCategoryCreateButton categories={categories} />
				<Text size="xs" tone="muted" className="ml-auto min-w-12 text-right font-mono tabular-nums">
					{filtered.length}/{skills.length}
				</Text>
			</div>

			{loading && (
				<Text size="sm" tone="muted">
					Carregando skills...
				</Text>
			)}

			{!loading && (
				<div className="min-h-0 flex-1 transform-gpu overflow-y-auto overscroll-contain pr-1">
					<div className="grid grid-cols-3 lg:grid-cols-4 gap-3 pb-5">
						<SkillCreateTile />
					</div>

					<div className="flex flex-col gap-5">
						{sections.map(({ key, category, skills: sectionSkills }) => {
							const isCollapsed = collapsed.has(key);
							return (
								<section key={key} className="flex flex-col gap-2">
									<SkillCategoryHeader
										category={category}
										count={sectionSkills.length}
										collapsed={isCollapsed}
										onToggleCollapse={() => toggleCollapsed(key)}
									/>

									{!isCollapsed && (
										<div className="grid grid-cols-3 lg:grid-cols-4 gap-3">
											{sectionSkills.map((skill, index) => (
												<SkillTile
													key={skill.slug}
													skill={skill}
													index={index}
													onAppearance={() => setAppearanceSlug(skill.slug)}
												/>
											))}
											{sectionSkills.length === 0 && (
												<Text size="sm" tone="muted" className="px-1 py-2">
													Nenhuma skill nesta categoria.
												</Text>
											)}
										</div>
									)}
								</section>
							);
						})}
					</div>

					{skills.length > 0 && filtered.length === 0 && (
						<Text size="sm" tone="muted" className="pt-3">
							Nenhuma skill corresponde aos filtros
						</Text>
					)}
				</div>
			)}

			<SkillAppearanceDialog
				skill={appearanceSkill}
				categories={categories}
				onClose={() => setAppearanceSlug(null)}
			/>
		</div>
	);
}

type SkillTileProps = {
	skill: TaskSkill;
	index: number;
	onAppearance: () => void;
};

function SkillTile({ skill, index, onAppearance }: SkillTileProps) {
	const findings = useMemo(
		() =>
			lintPrinciples({
				kind: "skill",
				slug: skill.slug,
				name: skill.label,
				description: skill.description,
				body: skill.instructions,
				metadata: skill.metadata,
			}),
		[skill.slug, skill.label, skill.description, skill.instructions, skill.metadata],
	);

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
			<Tooltip label="Aparência" triggerClassName="absolute right-2 top-2 inline-flex">
				<button
					type="button"
					onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						onAppearance();
					}}
					aria-label="Editar aparência"
					className="flex size-7 items-center justify-center border border-transparent text-muted-foreground opacity-0 transition-all hover:border-border hover:bg-background hover:text-foreground group-hover:opacity-100"
				>
					<SlidersHorizontal className="size-3.5" />
				</button>
			</Tooltip>

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
				{/* O badge abre um popover dentro do card-link: o clique no badge não deve navegar. */}
				<span
					onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
					}}
				>
					<PrinciplesFindings findings={findings} />
				</span>
			</div>
		</Link>
	);
}
