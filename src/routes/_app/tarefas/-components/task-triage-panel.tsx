import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	CheckCircle2,
	ChevronsDownUp,
	ChevronsUpDown,
	ChevronDown,
	SlidersHorizontal,
	PanelLeft,
	Plus,
	Search,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { orpc, type RouterOutputs } from "@/client";
import { TASK_SORT_OPTIONS } from "@/components/tasks/task-sort-controls";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip } from "@/components/ui/tooltip";
import { TASK_COMPLEXITIES, COMPLEXITY_LABELS, type TaskComplexity } from "@/constants/complexity";
import type { TaskSortMode } from "@/constants/tasks";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { errorMessage } from "@/lib/orpc-errors";
import type { TaskGroup, TaskWithMeta } from "@/types/tasks";

type Category = RouterOutputs["categories"]["list"][number];
type Priority = RouterOutputs["priorities"]["list"][number];
type Project = RouterOutputs["projects"]["list"][number];

export type TriageSearch = {
	q?: string;
	taskTypeId?: string;
	priorityId?: string;
	complexity?: TaskComplexity;
	includeCompleted?: boolean;
};

type Props = {
	projectId: string | null;
	projects: Project[];
	groups: TaskGroup[];
	tasks: TaskWithMeta[];
	categories: Category[];
	priorities: Priority[];
	search: TriageSearch;
	onSearchChange: (next: TriageSearch) => void;
	onProjectChange: (projectId?: string) => void;
	sortMode: TaskSortMode;
	onSortModeChange: (mode: TaskSortMode) => void;
	onCollapseAll: () => void;
	onExpandAll: () => void;
	onNewTask: () => void;
	maintenance: React.ReactNode;
};

function FilterSelect({
	label,
	value,
	items,
	onChange,
}: {
	label: string;
	value?: string;
	items: { id: string; name: string; color?: string }[];
	onChange: (value?: string) => void;
}) {
	const selected = items.find((item) => item.id === value);
	return (
		<CustomSelect
			items={[{ id: "__all__", name: `Todas: ${label}` }, ...items]}
			value={value ?? "__all__"}
			onValueChange={(next) => onChange(next === "__all__" ? undefined : next)}
			label={label}
			triggerClassName="h-8 w-full bg-background text-xs"
			renderTrigger={() => (
				<>
					<span className="truncate">{selected?.name ?? label}</span>
					<ChevronDown className="ml-auto size-3.5 text-muted-foreground" />
				</>
			)}
			renderItem={(item) => <span className="block truncate px-3 py-2">{item.name}</span>}
		/>
	);
}

function FeatureIndex({ groups, tasks, projectId }: Pick<Props, "groups" | "tasks" | "projectId">) {
	const visibleGroups = projectId
		? groups.filter((group) => group.projectId === projectId)
		: groups;
	const counts = useMemo(() => {
		const result = new Map<string, number>();
		for (const task of tasks) {
			if (task.groupId) result.set(task.groupId, (result.get(task.groupId) ?? 0) + 1);
		}
		return result;
	}, [tasks]);

	return (
		<div className="space-y-1">
			{visibleGroups.map((group) => (
				<Link
					key={group.id}
					to="/tarefas/$taskId"
					params={{ taskId: group.id }}
					search={{ projectId: group.projectId }}
					className="flex h-8 items-center gap-2 border-l-2 px-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
					style={{ borderLeftColor: group.color }}
				>
					<span className="min-w-0 flex-1 truncate">{group.name}</span>
					<span className="tabular-nums text-muted-foreground/70">{counts.get(group.id) ?? 0}</span>
				</Link>
			))}
			{visibleGroups.length === 0 && (
				<Text size="xs" tone="muted" className="px-2 py-2">
					Nenhuma feature neste projeto.
				</Text>
			)}
		</div>
	);
}

export function TaskTriagePanel(props: Props) {
	const queryClient = useQueryClient();
	const [featuresOpen, setFeaturesOpen] = useState(false);
	const [filtersOpen, setFiltersOpen] = useState(false);
	const [creatingFeature, setCreatingFeature] = useState(false);
	const [featureName, setFeatureName] = useState("");
	const [searchDraft, setSearchDraft] = useDebouncedSearch(props.search.q ?? "", (next) => {
		props.onSearchChange({ ...props.search, q: next.trim() || undefined });
	});
	const activeFilters = [
		props.search.taskTypeId,
		props.search.priorityId,
		props.search.complexity,
	].filter(Boolean);
	const selectedProject = props.projects.find((project) => project.id === props.projectId);
	const complexityItems = TASK_COMPLEXITIES.map((id) => ({ id, name: COMPLEXITY_LABELS[id] }));
	const projectItems = [
		{ id: "__all__", name: "Todos os projetos", color: "#64748b" },
		...props.projects,
	];
	const createFeature = useMutation({
		...orpc.taskGroups.create.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				predicate: (query) =>
					Array.isArray(query.queryKey?.[0]) && query.queryKey[0][0] === "taskGroups",
			});
			setFeatureName("");
			setCreatingFeature(false);
		},
		onError: (error) => toast.error(errorMessage(error, "Não foi possível criar a feature")),
	});

	function submitFeature() {
		const name = featureName.trim();
		if (!name || !props.projectId) return;
		const colors = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#a855f7"];
		createFeature.mutate({
			projectId: props.projectId,
			name,
			color: colors[props.groups.length % colors.length],
		});
	}

	function clearFilters() {
		props.onSearchChange({
			...props.search,
			taskTypeId: undefined,
			priorityId: undefined,
			complexity: undefined,
		});
	}

	const searchBox = (
		<div className="relative">
			<Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				value={searchDraft}
				onChange={(event) => setSearchDraft(event.target.value)}
				placeholder="Buscar tarefas"
				className="h-9 bg-background pl-8"
			/>
		</div>
	);

	const filters = (
		<div className="space-y-2">
			<FilterSelect
				label="Tipo"
				value={props.search.taskTypeId}
				items={props.categories}
				onChange={(taskTypeId) => props.onSearchChange({ ...props.search, taskTypeId })}
			/>
			<FilterSelect
				label="Prioridade"
				value={props.search.priorityId}
				items={props.priorities}
				onChange={(priorityId) => props.onSearchChange({ ...props.search, priorityId })}
			/>
			<FilterSelect
				label="Complexidade"
				value={props.search.complexity}
				items={complexityItems}
				onChange={(complexity) =>
					props.onSearchChange({
						...props.search,
						complexity: complexity as TaskComplexity | undefined,
					})
				}
			/>
		</div>
	);

	const sectionLabel = "font-semibold uppercase tracking-[0.12em]";

	const controls = (
		<div className="space-y-4">
			<div className="space-y-2">
				<Text size="xs" tone="muted" className={sectionLabel}>
					Filtros
				</Text>
				{filters}
			</div>
			<div className="space-y-2">
				<Text size="xs" tone="muted" className={sectionLabel}>
					Ordenação
				</Text>
				<div className="grid grid-cols-2 gap-1.5">
					{TASK_SORT_OPTIONS.map(({ mode, label, icon: Icon }) => (
						<Button
							key={mode}
							size="sm"
							variant={props.sortMode === mode ? "secondary" : "outline"}
							className="justify-start"
							onClick={() => props.onSortModeChange(mode)}
						>
							<Icon className="size-4" />
							{label}
						</Button>
					))}
				</div>
			</div>
			<div className="space-y-2">
				<Text size="xs" tone="muted" className={sectionLabel}>
					Grupos
				</Text>
				<div className="grid grid-cols-2 gap-1.5">
					<Button
						size="sm"
						variant="outline"
						className="justify-start"
						onClick={props.onCollapseAll}
					>
						<ChevronsDownUp className="size-4" />
						Recolher
					</Button>
					<Button size="sm" variant="outline" className="justify-start" onClick={props.onExpandAll}>
						<ChevronsUpDown className="size-4" />
						Expandir
					</Button>
				</div>
			</div>
			<div className="space-y-2">
				<Text size="xs" tone="muted" className={sectionLabel}>
					Manutenção
				</Text>
				{props.maintenance}
			</div>
			{activeFilters.length > 0 && (
				<Button
					size="sm"
					variant="ghost"
					className="w-full justify-start text-muted-foreground"
					onClick={clearFilters}
				>
					<X className="size-4" />
					Limpar filtros
				</Button>
			)}
		</div>
	);

	const activeChips = activeFilters.length > 0 && (
		<>
			{props.search.taskTypeId && (
				<Button
					size="sm"
					variant="secondary"
					className="h-6 shrink-0 px-2 text-xs"
					onClick={() => props.onSearchChange({ ...props.search, taskTypeId: undefined })}
				>
					{props.categories.find((item) => item.id === props.search.taskTypeId)?.name}
					<X className="size-3" />
				</Button>
			)}
			{props.search.priorityId && (
				<Button
					size="sm"
					variant="secondary"
					className="h-6 shrink-0 px-2 text-xs"
					onClick={() => props.onSearchChange({ ...props.search, priorityId: undefined })}
				>
					{props.priorities.find((item) => item.id === props.search.priorityId)?.name}
					<X className="size-3" />
				</Button>
			)}
			{props.search.complexity && (
				<Button
					size="sm"
					variant="secondary"
					className="h-6 shrink-0 px-2 text-xs"
					onClick={() => props.onSearchChange({ ...props.search, complexity: undefined })}
				>
					{COMPLEXITY_LABELS[props.search.complexity]}
					<X className="size-3" />
				</Button>
			)}
		</>
	);

	const completedButton = (
		<Tooltip label={props.search.includeCompleted ? "Ocultar concluídas" : "Mostrar concluídas"}>
			<Button
				size="icon-sm"
				variant={props.search.includeCompleted ? "secondary" : "outline"}
				className="size-9 shrink-0"
				aria-label={props.search.includeCompleted ? "Ocultar concluídas" : "Mostrar concluídas"}
				aria-pressed={!!props.search.includeCompleted}
				onClick={() =>
					props.onSearchChange({
						...props.search,
						includeCompleted: props.search.includeCompleted ? undefined : true,
					})
				}
			>
				<CheckCircle2 className="size-4" />
			</Button>
		</Tooltip>
	);

	return (
		<>
			<div className="sticky top-0 z-20 -mx-5 border-b border-border bg-background/95 px-5 py-2 backdrop-blur md:hidden">
				{searchBox}
				<div className="mt-2 flex gap-2 overflow-x-auto">
					<Button size="sm" className="shrink-0" onClick={props.onNewTask}>
						<Plus className="size-4" />
						Nova tarefa
					</Button>
					{completedButton}
					<Button
						size="sm"
						variant="outline"
						className="shrink-0"
						onClick={() => setFeaturesOpen(true)}
					>
						<PanelLeft className="size-4" />
						Features
					</Button>
					<Button
						size="sm"
						variant={activeFilters.length ? "secondary" : "outline"}
						className="shrink-0"
						onClick={() => setFiltersOpen(true)}
					>
						<SlidersHorizontal className="size-4" />
						Mais {activeFilters.length > 0 && `(${activeFilters.length})`}
					</Button>
				</div>
				{activeFilters.length > 0 && (
					<div className="mt-2 flex gap-1.5 overflow-x-auto">{activeChips}</div>
				)}
			</div>

			<div className="col-span-2 hidden items-center gap-2 border-b border-border bg-card/35 px-4 py-2 md:flex">
				<div className="w-52 shrink-0">
					<CustomSelect
						items={projectItems}
						value={props.projectId ?? "__all__"}
						onValueChange={(value) =>
							props.onProjectChange(value === "__all__" ? undefined : value)
						}
						label="Projeto"
						triggerClassName="h-9 w-full bg-background"
						renderTrigger={() => (
							<>
								<span className="flex min-w-0 items-center gap-2">
									<span
										className="size-2 shrink-0 rounded-full"
										style={{ backgroundColor: selectedProject?.color ?? "#64748b" }}
									/>
									<span className="truncate">{selectedProject?.name ?? "Todos os projetos"}</span>
								</span>
								<ChevronDown className="ml-auto size-4 text-muted-foreground" />
							</>
						)}
						renderItem={(item) => (
							<span className="flex items-center gap-2 px-3 py-2">
								<span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
								{item.name}
							</span>
						)}
					/>
				</div>
				<div className="min-w-0 max-w-md flex-1">{searchBox}</div>
				<div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
					{activeChips}
				</div>
				{completedButton}
				<Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
					<PopoverTrigger asChild>
						<Button
							size="sm"
							variant={activeFilters.length ? "secondary" : "outline"}
							className="shrink-0"
						>
							<SlidersHorizontal className="size-4" />
							Mais {activeFilters.length > 0 && `(${activeFilters.length})`}
						</Button>
					</PopoverTrigger>
					<PopoverContent align="end" className="w-72 p-4">
						{controls}
					</PopoverContent>
				</Popover>
			</div>

			<aside className="hidden h-full min-h-0 w-[300px] shrink-0 flex-col border-r border-border bg-card/35 md:flex">
				<div className="min-h-0 flex-1 overflow-y-auto p-4">
					<div className="mb-2 flex items-center justify-between">
						<Text size="xs" className="font-semibold uppercase tracking-[0.12em]">
							Índice de features
						</Text>
						<div className="flex items-center gap-1">
							<span className="text-xs tabular-nums text-muted-foreground">
								{props.groups.length}
							</span>
							{props.projectId && (
								<Button
									size="icon-sm"
									variant="ghost"
									aria-label="Nova feature"
									onClick={() => setCreatingFeature(true)}
								>
									<Plus className="size-3.5" />
								</Button>
							)}
						</div>
					</div>
					{creatingFeature && (
						<div className="mb-2 flex gap-1">
							<Input
								autoFocus
								value={featureName}
								onChange={(event) => setFeatureName(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === "Enter") submitFeature();
									if (event.key === "Escape") setCreatingFeature(false);
								}}
								placeholder="Nome da feature"
								className="h-8"
							/>
							<Button
								size="sm"
								className="h-8 px-2"
								disabled={createFeature.isPending}
								onClick={submitFeature}
							>
								Criar
							</Button>
						</div>
					)}
					<FeatureIndex groups={props.groups} tasks={props.tasks} projectId={props.projectId} />
				</div>
			</aside>

			<Drawer
				open={featuresOpen}
				onClose={() => setFeaturesOpen(false)}
				side="left"
				title="Índice de features"
				description={selectedProject?.name ?? "Todos os projetos"}
			>
				<div className="space-y-3">
					{props.projectId &&
						(creatingFeature ? (
							<div className="flex gap-1">
								<Input
									autoFocus
									value={featureName}
									onChange={(event) => setFeatureName(event.target.value)}
									placeholder="Nome da feature"
									className="h-9"
								/>
								<Button size="sm" disabled={createFeature.isPending} onClick={submitFeature}>
									Criar
								</Button>
							</div>
						) : (
							<Button
								size="sm"
								variant="outline"
								className="w-full"
								onClick={() => setCreatingFeature(true)}
							>
								<Plus className="size-4" />
								Nova feature
							</Button>
						))}
					<FeatureIndex groups={props.groups} tasks={props.tasks} projectId={props.projectId} />
				</div>
			</Drawer>

			<div className="md:hidden">
				<Drawer
					open={filtersOpen}
					onClose={() => setFiltersOpen(false)}
					side="bottom"
					title="Filtros e ordenação"
				>
					<div className="space-y-4">
						<CustomSelect
							items={projectItems}
							value={props.projectId ?? "__all__"}
							onValueChange={(value) =>
								props.onProjectChange(value === "__all__" ? undefined : value)
							}
							label="Projeto"
							triggerClassName="w-full"
							renderTrigger={() => (
								<>
									<span>{selectedProject?.name ?? "Todos os projetos"}</span>
									<ChevronDown className="ml-auto size-4" />
								</>
							)}
							renderItem={(item) => <span className="block px-3 py-2">{item.name}</span>}
						/>
						{controls}
					</div>
				</Drawer>
			</div>
		</>
	);
}
