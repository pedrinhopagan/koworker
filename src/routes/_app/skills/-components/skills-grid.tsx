import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Search, SlidersHorizontal, TriangleAlert, X } from "lucide-react";
import {
	memo,
	type KeyboardEvent as ReactKeyboardEvent,
	type ReactNode,
	useDeferredValue,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { PrinciplesFindings } from "@/components/principles/principles-findings";
import { Text } from "@/components/typography";
import { Chip } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CustomSelect } from "@/components/ui/custom-select";
import { Input } from "@/components/ui/input";
import { SKILL_TOOL_LABEL } from "@/constants/skills";
import { openFolderInOs, shareFolderAsZip } from "@/lib/os-share";
import { LucideIcon } from "@/lib/lucide-icon";
import { createSkillSearch, type SkillSearchHit, type TextRange } from "@/lib/skill-search";
import { cn } from "@/lib/utils";
import type { SkillCategory, TaskSkill } from "@/types/skills";
import { SkillAppearanceDialog } from "./skill-appearance-dialog";
import { SkillCategoryCreateButton, SkillCategoryHeader } from "./skill-categories-controls";
import { SkillCreateTile } from "./skill-create-tile";
import { SkillImportTile } from "./skill-import";
import { SkillSettingsMenu } from "./skill-settings-menu";
import { useSkillMutations } from "../-utils/use-skill-mutations";

const NO_CATEGORY_KEY = "__none__";
const URL_SYNC_DELAY = 250;
const GRID_CLASS = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

function distinctTools(skill: TaskSkill): TaskSkill["sources"][number]["tool"][] {
	return [...new Set(skill.sources.map((source) => source.tool))];
}

function isEditableTarget(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) return false;

	return (
		target.isContentEditable ||
		target.tagName === "INPUT" ||
		target.tagName === "TEXTAREA" ||
		target.tagName === "SELECT"
	);
}

type SkillsGridProps = {
	skills: TaskSkill[];
	categories: SkillCategory[];
	loading: boolean;
	search: string;
	onSearchChange: (value: string) => void;
};

export function SkillsGrid({
	skills,
	categories,
	loading,
	search,
	onSearchChange,
}: SkillsGridProps) {
	const [query, setQuery] = useState(search);
	const [activeIndex, setActiveIndex] = useState(0);
	const [categoryFilter, setCategoryFilter] = useState<string>("all");
	const [appearanceSlug, setAppearanceSlug] = useState<string | null>(null);
	const [deleteSlug, setDeleteSlug] = useState<string | null>(null);
	const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
	const inputRef = useRef<HTMLInputElement>(null);
	const syncedRef = useRef(search);
	const onSearchChangeRef = useRef(onSearchChange);
	onSearchChangeRef.current = onSearchChange;
	const navigate = useNavigate();
	const { removeAllSkill, removing } = useSkillMutations();

	const deferredQuery = useDeferredValue(query);
	const searching = deferredQuery.trim().length > 0;
	const stale = query !== deferredQuery;

	useEffect(() => {
		if (search !== syncedRef.current) {
			syncedRef.current = search;
			setQuery(search);
		}
	}, [search]);

	useEffect(() => {
		if (query === syncedRef.current) return;
		const timer = window.setTimeout(() => {
			syncedRef.current = query;
			onSearchChangeRef.current(query);
		}, URL_SYNC_DELAY);

		return () => window.clearTimeout(timer);
	}, [query]);

	useEffect(() => {
		function focusSearch(event: KeyboardEvent) {
			if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
			if (isEditableTarget(event.target)) return;
			event.preventDefault();
			inputRef.current?.focus();
			inputRef.current?.select();
		}
		window.addEventListener("keydown", focusSearch);

		return () => window.removeEventListener("keydown", focusSearch);
	}, []);

	const categoryIds = useMemo(
		() => new Set(categories.map((category) => category.id)),
		[categories],
	);

	const runSearch = useMemo(() => createSkillSearch(skills), [skills]);
	const hits = useMemo(() => {
		const all = runSearch(deferredQuery);
		if (categoryFilter === "all") return all;
		if (categoryFilter === NO_CATEGORY_KEY) {
			return all.filter((hit) => !hit.skill.categoryId || !categoryIds.has(hit.skill.categoryId));
		}

		return all.filter((hit) => hit.skill.categoryId === categoryFilter);
	}, [runSearch, deferredQuery, categoryFilter, categoryIds]);

	useEffect(() => {
		setActiveIndex(0);
	}, [deferredQuery, categoryFilter]);

	const groups = useMemo(() => {
		const byName = hits.filter((hit) => hit.kind === "name");
		const others = hits.filter((hit) => hit.kind !== "name");

		return [
			{ key: "name", title: "No nome", hits: byName, offset: 0 },
			{ key: "other", title: "Na descrição ou no conteúdo", hits: others, offset: byName.length },
		].filter((group) => group.hits.length > 0);
	}, [hits]);

	const sections = useMemo(() => {
		if (searching) return [];

		const byCategory = new Map<string, TaskSkill[]>();
		const orphans: TaskSkill[] = [];
		for (const { skill } of hits) {
			if (skill.categoryId && categoryIds.has(skill.categoryId)) {
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

		const filtering = categoryFilter !== "all";
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
	}, [searching, hits, categories, categoryIds, categoryFilter]);

	const filterOptions = useMemo(() => {
		const counts = new Map<string, number>();
		let orphanCount = 0;
		for (const skill of skills) {
			if (!skill.categoryId || !categoryIds.has(skill.categoryId)) {
				orphanCount += 1;
			} else {
				counts.set(skill.categoryId, (counts.get(skill.categoryId) ?? 0) + 1);
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
	}, [skills, categories, categoryIds]);

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

	function openSkill(slug: string) {
		void navigate({ to: "/skills/$slug", params: { slug } });
	}

	function handleSearchKey(event: ReactKeyboardEvent<HTMLInputElement>) {
		if (event.key === "Escape" && query) {
			event.preventDefault();
			setQuery("");
			return;
		}
		if (!searching || hits.length === 0) return;

		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			const step = event.key === "ArrowDown" ? 1 : -1;
			setActiveIndex((current) => (current + step + hits.length) % hits.length);
			return;
		}
		if (event.key === "Enter") {
			event.preventDefault();
			const hit = hits[Math.min(activeIndex, hits.length - 1)];
			if (hit) openSkill(hit.skill.slug);
		}
	}

	const appearanceSkill = appearanceSlug
		? (skills.find((skill) => skill.slug === appearanceSlug) ?? null)
		: null;
	const deleteSkill = deleteSlug
		? (skills.find((skill) => skill.slug === deleteSlug) ?? null)
		: null;

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex flex-wrap items-center gap-3 pb-4">
				<div className="relative min-w-[240px] flex-1">
					<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						ref={inputRef}
						type="text"
						role="combobox"
						aria-expanded={searching}
						aria-autocomplete="list"
						aria-label="Buscar skills"
						autoComplete="off"
						spellCheck={false}
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						onKeyDown={handleSearchKey}
						autoFocus
						placeholder="Buscar por nome, descrição ou conteúdo"
						className="w-full pl-9 pr-16"
					/>
					<div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
						{query && (
							<button
								type="button"
								aria-label="Limpar busca"
								onClick={() => {
									setQuery("");
									inputRef.current?.focus();
								}}
								className="flex size-6 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
							>
								<X className="size-3.5" />
							</button>
						)}
						{!query && (
							<kbd className="hidden border border-border px-1.5 font-mono text-[10px] text-muted-foreground sm:block">
								/
							</kbd>
						)}
					</div>
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
									className="size-2 shrink-0"
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
								className="size-2 shrink-0"
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
					{hits.length}/{skills.length}
				</Text>
			</div>

			{loading && (
				<Text size="sm" tone="muted">
					Carregando skills...
				</Text>
			)}

			{!loading && (
				<div
					className={cn(
						"min-h-0 flex-1 transform-gpu overflow-y-auto overscroll-contain pr-1 transition-opacity duration-150",
						stale && "opacity-70",
					)}
				>
					{searching && (
						<div className="flex flex-col gap-5" role="listbox" aria-label="Resultados">
							{groups.map((group) => (
								<section key={group.key} className="flex flex-col gap-2">
									<Text size="xs" tone="muted" className="font-medium uppercase tracking-wide">
										{group.title} · {group.hits.length}
									</Text>
									<div className={GRID_CLASS}>
										{group.hits.map((hit, index) => (
											<SkillTile
												key={hit.skill.slug}
												skill={hit.skill}
												index={index}
												categories={categories}
												hit={hit}
												active={group.offset + index === activeIndex}
												onAppearance={setAppearanceSlug}
												onDelete={setDeleteSlug}
											/>
										))}
									</div>
								</section>
							))}
							{hits.length === 0 && skills.length > 0 && (
								<div className="flex flex-col gap-1 border border-dashed border-border px-4 py-6">
									<Text size="sm">Nada encontrado para "{deferredQuery.trim()}"</Text>
									<Text size="xs" tone="muted">
										Todas as palavras precisam aparecer no nome, na descrição ou no conteúdo
										{categoryFilter !== "all" && ", dentro da categoria filtrada"}.
									</Text>
								</div>
							)}
						</div>
					)}

					{!searching && (
						<>
							<div className={cn(GRID_CLASS, "pb-5")}>
								<SkillCreateTile />
								<SkillImportTile />
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
												<div className={GRID_CLASS}>
													{sectionSkills.map((skill, index) => (
														<SkillTile
															key={skill.slug}
															skill={skill}
															index={index}
															categories={categories}
															animate
															onAppearance={setAppearanceSlug}
															onDelete={setDeleteSlug}
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
							{skills.length > 0 && hits.length === 0 && (
								<Text size="sm" tone="muted" className="pt-3">
									Nenhuma skill nesta categoria
								</Text>
							)}
						</>
					)}
				</div>
			)}

			<SkillAppearanceDialog skill={appearanceSkill} onClose={() => setAppearanceSlug(null)} />
			<ConfirmDialog
				open={!!deleteSkill}
				onClose={() => setDeleteSlug(null)}
				onConfirm={() => {
					if (!deleteSkill) return;
					removeAllSkill({ slug: deleteSkill.slug }, () => setDeleteSlug(null));
				}}
				title={`Deletar a skill "${deleteSkill?.label ?? ""}"?`}
				description="A skill será removida de todos os projetos e fontes configuradas. Antes disso, uma cópia completa será salva em ~/Documentos/backups/koworker/skills/."
				confirmLabel="Deletar"
				variant="danger"
				loading={removing}
			/>
		</div>
	);
}

function Highlighted({ text, ranges }: { text: string; ranges: TextRange[] }) {
	if (ranges.length === 0) return text;

	const parts: ReactNode[] = [];
	let cursor = 0;
	for (const [start, end] of ranges) {
		if (start > cursor) parts.push(text.slice(cursor, start));
		parts.push(
			<mark key={start} className="bg-primary/20 text-foreground">
				{text.slice(start, end)}
			</mark>,
		);
		cursor = end;
	}
	if (cursor < text.length) parts.push(text.slice(cursor));

	return parts;
}

type SkillTileProps = {
	skill: TaskSkill;
	index: number;
	categories: SkillCategory[];
	hit?: SkillSearchHit;
	active?: boolean;
	animate?: boolean;
	onAppearance: (slug: string) => void;
	onDelete: (slug: string) => void;
};

const SkillTile = memo(function SkillTile({
	skill,
	index,
	categories,
	hit,
	active,
	animate,
	onAppearance,
	onDelete,
}: SkillTileProps) {
	const navigate = useNavigate();
	const [menuOpen, setMenuOpen] = useState(false);
	const tileRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (active) tileRef.current?.scrollIntoView({ block: "nearest" });
	}, [active]);

	return (
		<div
			ref={tileRef}
			role={hit ? "option" : undefined}
			aria-selected={hit ? !!active : undefined}
			data-active={active || undefined}
			className={cn(
				"group relative flex min-w-0 flex-col p-4",
				"border border-border border-t-2 bg-card transition-colors",
				"hover:bg-secondary/50 data-[active]:bg-secondary/60 data-[active]:outline data-[active]:outline-1 data-[active]:-outline-offset-1 data-[active]:outline-ring",
				animate && "animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both",
			)}
			style={{
				borderTopColor: skill.color,
				animationDelay: animate ? `${Math.min(index, 12) * 35}ms` : undefined,
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
				to="/skills/$slug"
				params={{ slug: skill.slug }}
				aria-label={skill.label}
				className="absolute inset-0 z-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
			/>

			<SkillSettingsMenu
				skill={skill}
				categories={categories}
				onAppearance={() => onAppearance(skill.slug)}
				open={menuOpen}
				onOpenChange={setMenuOpen}
				docActions={{
					onOpen: () => navigate({ to: "/skills/$slug", params: { slug: skill.slug } }),
					onOpenInOs: () => void openFolderInOs(skill.primaryDir),
					onShareZip: () => void shareFolderAsZip(skill.primaryDir),
					onDelete: () => onDelete(skill.slug),
				}}
				trigger={
					<button
						type="button"
						aria-label="Ações da skill"
						title="Ações da skill"
						className="absolute right-2 top-2 z-10 flex size-11 sm:size-7 items-center justify-center border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-background hover:text-foreground data-[state=open]:border-border data-[state=open]:bg-background"
					>
						<SlidersHorizontal className="size-3.5" />
					</button>
				}
			/>

			<div className="pointer-events-none relative z-10 flex flex-col gap-3">
				<div className="flex items-center gap-3">
					<div
						className="flex h-10 w-10 shrink-0 items-center justify-center border bg-muted/30 transition-colors group-hover:bg-muted/60"
						style={{ borderColor: skill.color, color: skill.color }}
					>
						<LucideIcon name={skill.icon} className="size-5" />
					</div>
					<div className="min-w-0 flex-1 pr-10 sm:pr-7">
						<div className="truncate font-display text-sm font-semibold leading-tight">
							<Highlighted text={skill.label} ranges={hit?.labelRanges ?? []} />
						</div>
						<div className="truncate font-mono text-[11px] text-muted-foreground">
							<Highlighted text={skill.slug} ranges={hit?.slugRanges ?? []} />
						</div>
					</div>
				</div>

				{hit?.snippet && (
					<div className="flex flex-col gap-1">
						<span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
							No conteúdo
						</span>
						<p className="line-clamp-2 min-h-[2.5rem] border-l-2 border-primary/40 pl-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
							<Highlighted text={hit.snippet.text} ranges={hit.snippet.ranges} />
						</p>
					</div>
				)}
				{!hit?.snippet && (
					<p className="line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-muted-foreground">
						<Highlighted text={skill.description} ranges={hit?.descriptionRanges ?? []} />
					</p>
				)}

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
					<span className="pointer-events-auto">
						<PrinciplesFindings findings={skill.findings} />
					</span>
				</div>
			</div>
		</div>
	);
});
