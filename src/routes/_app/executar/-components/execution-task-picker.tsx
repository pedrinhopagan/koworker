import { Check, CheckCircle2, ListFilter, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { RouterOutputs } from "@/client";
import { TaskGroupLabel } from "@/components/tasks/task-group-label";
import { TaskSortControls } from "@/components/tasks/task-sort-controls";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useRovingListbox } from "@/hooks/use-roving-listbox";
import { useTaskSortMode } from "@/hooks/use-task-sort-mode";
import { sortTasksByMode } from "@/lib/task-sorting";
import type { TaskWithMeta } from "@/types/tasks";
import { ExecutionTaskFilters, type ExecutionTaskFilterValue } from "./execution-task-filters";
import { ExecutionTaskOption } from "./execution-task-option";

type Task = RouterOutputs["tasks"]["listByProject"][number];
type Category = RouterOutputs["categories"]["list"][number];
type Priority = RouterOutputs["priorities"]["list"][number];
type TaskGroup = RouterOutputs["taskGroups"]["list"][number];

export function ExecutionTaskPicker({
	tasks,
	categories,
	priorities,
	groups,
	selectedTask,
	disabled,
	loading,
	onChange,
	onClear,
}: {
	tasks: Task[];
	categories: Category[];
	priorities: Priority[];
	groups: TaskGroup[];
	selectedTask?: Task;
	disabled: boolean;
	loading: boolean;
	onChange: (taskId: string) => void;
	onClear: () => void;
}) {
	const [open, setOpen] = useState(false);
	const triggerRef = useRef<HTMLDivElement>(null);
	const [query, setQuery] = useState("");
	const [filters, setFilters] = useState<ExecutionTaskFilterValue>({});
	const [sortMode, setSortMode] = useTaskSortMode();
	const categoriesById = useMemo(
		() => new Map(categories.map((category) => [category.id, category])),
		[categories],
	);
	const prioritiesById = useMemo(
		() => new Map(priorities.map((priority) => [priority.id, priority])),
		[priorities],
	);
	const tasksWithMeta = useMemo<TaskWithMeta[]>(
		() =>
			tasks.map((task) => ({
				...task,
				category: task.categoryId ? (categoriesById.get(task.categoryId) ?? null) : null,
				priority: task.priorityId ? (prioritiesById.get(task.priorityId) ?? null) : null,
			})),
		[tasks, categoriesById, prioritiesById],
	);
	const filteredTasks = useMemo(() => {
		const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");

		return tasksWithMeta.filter((task) => {
			if (!filters.includeCompleted && task.done) {
				return false;
			}
			if (filters.categoryId && task.categoryId !== filters.categoryId) {
				return false;
			}
			if (filters.priorityId && task.priorityId !== filters.priorityId) {
				return false;
			}
			if (filters.complexity && task.complexity !== filters.complexity) {
				return false;
			}
			if (!normalizedQuery) {
				return true;
			}

			return `${task.displayTitle} ${task.folderPath}`
				.toLocaleLowerCase("pt-BR")
				.includes(normalizedQuery);
		});
	}, [filters, query, tasksWithMeta]);
	const groupedTasks = useMemo(() => {
		const sorted = sortTasksByMode(filteredTasks, sortMode, categories, priorities);
		const byGroup = new Map<string | null, TaskWithMeta[]>();
		const groupIds = new Set(groups.map((group) => group.id));

		for (const task of sorted) {
			const groupId = task.groupId && groupIds.has(task.groupId) ? task.groupId : null;
			const groupTasks = byGroup.get(groupId);
			if (groupTasks) {
				groupTasks.push(task);
			} else {
				byGroup.set(groupId, [task]);
			}
		}

		const sections: { group?: TaskGroup; tasks: TaskWithMeta[] }[] = [
			{ tasks: byGroup.get(null) ?? [] },
			...[...groups]
				.sort((a, b) => a.displayOrder - b.displayOrder)
				.map((group) => ({ group, tasks: byGroup.get(group.id) ?? [] })),
		];

		return sections.filter((section) => section.tasks.length > 0);
	}, [categories, filteredTasks, groups, priorities, sortMode]);

	const flatTasks = useMemo(() => groupedTasks.flatMap((section) => section.tasks), [groupedTasks]);
	const indexById = useMemo(
		() => new Map(flatTasks.map((task, index) => [task.id, index])),
		[flatTasks],
	);

	function selectTask(taskId: string) {
		onChange(taskId);
		close();
	}

	const { activeIndex, focusedIndex, setActiveIndex, onKeyDown } = useRovingListbox({
		count: flatTasks.length,
		onSelect: (index) => {
			const task = flatTasks[index];
			if (task) {
				selectTask(task.id);
			}
		},
	});

	useEffect(() => {
		setActiveIndex(0);
	}, [query, filters, setActiveIndex]);

	useEffect(() => {
		if (!open) {
			return;
		}

		const scrollContainer = triggerRef.current?.closest<HTMLElement>(".overflow-y-auto");
		if (!scrollContainer) {
			return;
		}

		const overflowY = scrollContainer.style.overflowY;
		scrollContainer.style.overflowY = "hidden";

		return () => {
			scrollContainer.style.overflowY = overflowY;
		};
	}, [open]);

	function close() {
		setOpen(false);
	}

	return (
		<>
			<div ref={triggerRef} className="flex min-w-0 flex-1 flex-col gap-1.5">
				<Text
					as="span"
					size="xs"
					className="font-semibold uppercase tracking-[0.14em] text-muted-foreground"
				>
					Tarefa
				</Text>
				<button
					type="button"
					disabled={disabled || loading}
					onClick={() => setOpen(true)}
					className="flex h-10 min-w-0 items-center gap-3 border border-input bg-card px-3 text-left text-sm transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
				>
					<ListFilter className="size-4 shrink-0 text-muted-foreground" />
					<span
						className={cn(
							"min-w-0 flex-1 truncate font-medium",
							selectedTask ? "text-foreground" : "text-muted-foreground",
						)}
					>
						{loading
							? "Carregando tarefas…"
							: (selectedTask?.displayTitle ?? "Criar tarefa nova para esta conversa")}
					</span>
					{selectedTask?.done && <CheckCircle2 className="size-4 shrink-0 text-primary" />}
				</button>
			</div>

			<Dialog
				open={open}
				onClose={close}
				title="Escolher tarefa"
				description="A lista começa pelas pendentes e segue os mesmos filtros de Tarefas."
				className="max-w-3xl"
			>
				<div onKeyDown={onKeyDown}>
					<div className="relative">
						<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Buscar pelo título ou diretório…"
							className="pr-10 pl-10"
							autoFocus
						/>
						{query && (
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								onClick={() => setQuery("")}
								className="absolute top-1/2 right-1 -translate-y-1/2"
								aria-label="Limpar busca"
							>
								<X className="size-4" />
							</Button>
						)}
					</div>

					<div className="mt-3">
						<ExecutionTaskFilters
							value={filters}
							categories={categories}
							priorities={priorities}
							onChange={setFilters}
						/>
					</div>

					<button
						type="button"
						onClick={() => {
							onClear();
							close();
						}}
						className="mt-3 flex min-h-12 w-full items-center gap-3 border border-dashed border-border px-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
					>
						<span className="flex size-7 shrink-0 items-center justify-center border border-border bg-background">
							{!selectedTask && <Check className="size-4" />}
						</span>
						<span>
							<Text className="font-semibold">Criar tarefa nova</Text>
							<Text size="xs" tone="muted">
								A conversa ganha uma pasta própria no projeto.
							</Text>
						</span>
					</button>

					<div className="my-3 flex items-center justify-between gap-3 border-b border-border pb-2">
						<Text className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
							Tarefas
						</Text>
						<span className="flex min-w-0 items-center gap-2">
							<TaskSortControls value={sortMode} onChange={setSortMode} />
							<Text size="xs" tone="muted" className="shrink-0 tabular-nums">
								{filteredTasks.length} de {tasks.length}
							</Text>
						</span>
					</div>

					{filteredTasks.length === 0 && (
						<div className="border border-dashed border-border p-8 text-center">
							<Search className="mx-auto mb-3 size-5 text-muted-foreground" />
							<Title as="h3" size="sm">
								Nenhuma tarefa encontrada
							</Title>
							<Text size="sm" tone="muted">
								Ajuste a busca ou os filtros.
							</Text>
						</div>
					)}

					<div className="flex flex-col gap-5" role="listbox" aria-label="Tarefas disponíveis">
						{groupedTasks.map(({ group, tasks: sectionTasks }) => (
							<section key={group?.id ?? "sem-feature"} className="flex flex-col gap-1.5">
								<TaskGroupLabel
									name={group?.name}
									color={group?.color}
									count={sectionTasks.length}
								/>
								{sectionTasks.map((task) => {
									const index = indexById.get(task.id) ?? -1;
									return (
										<ExecutionTaskOption
											key={task.id}
											task={task}
											category={task.category ?? undefined}
											priority={task.priority ?? undefined}
											selected={task.id === selectedTask?.id}
											active={index === activeIndex}
											focused={index === focusedIndex}
											onActivate={() => setActiveIndex(index)}
											onSelect={() => selectTask(task.id)}
										/>
									);
								})}
							</section>
						))}
					</div>
				</div>
			</Dialog>
		</>
	);
}
