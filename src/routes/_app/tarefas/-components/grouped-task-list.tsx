import {
	closestCorners,
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type QueryKey, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import { useMemo, useState } from "react";

import { orpc } from "@/client";
import { TaskItem } from "@/components/tasks";
import { Text } from "@/components/typography";
import type { TaskSortMode } from "@/constants/tasks";
import { RECENCY_FRESH_WINDOW_MS, TASK_RECENCY_HIGHLIGHT_DEPTH } from "@/constants/tasks";
import { invalidateTaskQueries } from "@/lib/task-query-invalidation";
import { sortTasksByMode } from "@/lib/task-sorting";
import { cn } from "@/lib/utils";
import { useTaskGroupsUiStore } from "@/stores/task-groups-ui";
import type { Task, TaskGroup } from "@/types/tasks";
import { TaskGroupHeader } from "./task-groups-controls";

export const NO_GROUP = "__none__";
// Chave de colapso do slot "Sem feature". Em "Todos os projetos" o sentinela NO_GROUP é o mesmo em
// todos os projetos, então colapsá-lo namespaceia por projeto pra não fechar o "Sem feature" dos
// demais. Sem projectId (modo single) é o NO_GROUP puro — idêntico ao de hoje.
export function noGroupKey(projectId?: string) {
	return projectId ? `${projectId}:${NO_GROUP}` : NO_GROUP;
}

// Id sortable/droppable de uma seção de grupo. Reaproveita o prefixo "group::" que
// resolveTargetBucket já entende para drop de tarefas sobre um cabeçalho.
function groupDropId(groupId: string | null) {
	return `group::${groupId ?? NO_GROUP}`;
}

// Inverso de groupDropId: extrai o slot (`groupId` real ou null para "Sem grupo") de um id de
// drop/sortable de grupo.
function slotFromGroupDropId(dropId: string): string | null {
	const raw = dropId.startsWith("group::") ? dropId.slice("group::".length) : dropId;
	return raw === NO_GROUP ? null : raw;
}

function isTasksQueryKey(queryKey: QueryKey) {
	return Array.isArray(queryKey) && Array.isArray(queryKey[0]) && queryKey[0][0] === "tasks";
}

function isTaskGroupsQueryKey(queryKey: QueryKey) {
	return Array.isArray(queryKey) && Array.isArray(queryKey[0]) && queryKey[0][0] === "taskGroups";
}

function updateTasksCache(old: unknown, update: (task: Task) => Task): unknown {
	if (Array.isArray(old)) return old.map(update);
	if (!old || typeof old !== "object" || !("pages" in old) || !Array.isArray(old.pages)) {
		return old;
	}

	return {
		...old,
		pages: old.pages.map((page) => {
			if (!page || typeof page !== "object" || !("tasks" in page) || !Array.isArray(page.tasks)) {
				return page;
			}
			return { ...page, tasks: page.tasks.map(update) };
		}),
	};
}

function buildBuckets(tasks: Task[], mode: TaskSortMode) {
	const sorted = sortTasksByMode(tasks, mode);

	const buckets: Record<string, string[]> = {};
	for (const task of sorted) {
		(buckets[task.groupId ?? NO_GROUP] ??= []).push(task.id);
	}
	return buckets;
}

// Top-N tarefas pendentes por última edição → nível de destaque (1 = mais recente). O ranking é
// por projeto (a visão "Todos os projetos" não deixa uma task de um projeto roubar o destaque de
// outro): cada projeto tem seus próprios top-N. Só entram tarefas editadas dentro da janela de
// frescor — destacar uma parada há meses seria chamar de "recente" o que não é.
function buildHighlightLevels(tasks: Task[]) {
	const freshFloor = Date.now() - RECENCY_FRESH_WINDOW_MS;

	const byProject = new Map<string, Task[]>();
	for (const task of tasks) {
		if (task.done || task.lastEditedAt < freshFloor) continue;
		const projectTasks = byProject.get(task.projectId);
		if (projectTasks) {
			projectTasks.push(task);
		} else {
			byProject.set(task.projectId, [task]);
		}
	}

	const levels = new Map<string, number>();
	for (const projectTasks of byProject.values()) {
		projectTasks
			.sort((a, b) => b.lastEditedAt - a.lastEditedAt)
			.slice(0, TASK_RECENCY_HIGHLIGHT_DEPTH)
			.forEach((task, index) => levels.set(task.id, index + 1));
	}
	return levels;
}

type GroupedTaskListProps = {
	tasks: Task[];
	groups: TaskGroup[];
	loading: boolean;
	sortMode: TaskSortMode;
	reorderingDisabled?: boolean;
	availableFeatures?: TaskGroup[];
	// Em "Todos os projetos" cada projeto monta uma instância; o prefixo isola só a chave de colapso
	// do slot "Sem feature" (NO_GROUP). Omitido no modo single → chave idêntica à de hoje.
	collapseKeyPrefix?: string;
};

export function GroupedTaskList({
	tasks,
	groups,
	loading,
	sortMode,
	reorderingDisabled = false,
	availableFeatures = groups,
	collapseKeyPrefix,
}: GroupedTaskListProps) {
	const queryClient = useQueryClient();
	const [activeId, setActiveId] = useState<string | null>(null);
	const collapsedKeys = useTaskGroupsUiStore((state) => state.collapsedKeys);
	const toggleCollapsed = useTaskGroupsUiStore((state) => state.toggleCollapsed);
	const noGroupOrder = useTaskGroupsUiStore((state) => state.noGroupOrder);
	const setNoGroupOrder = useTaskGroupsUiStore((state) => state.setNoGroupOrder);

	const taskMap = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

	const buckets = useMemo(() => buildBuckets(tasks, sortMode), [tasks, sortMode]);
	const highlightLevels = useMemo(() => buildHighlightLevels(tasks), [tasks]);

	const renderableGroups = useMemo(() => {
		const slots: { id: string | null; group?: TaskGroup }[] = groups.map((group) => ({
			id: group.id,
			group,
		}));
		const index = Math.min(Math.max(noGroupOrder, 0), slots.length);
		slots.splice(index, 0, { id: null });

		return slots
			.map(({ id, group }) => {
				const bucketKeys = buckets[id ?? NO_GROUP] ? [id ?? NO_GROUP] : [];
				const count = bucketKeys.reduce((sum, key) => sum + buckets[key].length, 0);
				return { id, group, bucketKeys, count };
			})
			.filter((slot) => slot.count > 0);
	}, [groups, noGroupOrder, buckets]);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

	const reorderMutation = useMutation({
		...orpc.tasks.reorder.mutationOptions(),
		onMutate: async (input) => {
			await queryClient.cancelQueries({ predicate: (q) => isTasksQueryKey(q.queryKey) });
			const previous = queryClient.getQueriesData({
				predicate: (q) => isTasksQueryKey(q.queryKey),
			});
			const orderIndex = new Map(input.orderedIds.map((id, index) => [id, index]));

			queryClient.setQueriesData({ predicate: (q) => isTasksQueryKey(q.queryKey) }, (old) =>
				updateTasksCache(old, (task) => {
					const index = orderIndex.get(task.id);
					if (index === undefined) return task;
					return {
						...task,
						groupId: input.groupId ?? undefined,
						displayOrder: index,
					};
				}),
			);
			return { previous };
		},
		onError: (_error, _input, context) => {
			for (const [key, data] of context?.previous ?? []) {
				queryClient.setQueryData(key, data);
			}
		},
		onSettled: (_data, _error, input) => {
			void invalidateTaskQueries(queryClient, {
				projectId: taskMap.get(input.orderedIds[0])?.projectId ?? null,
			});
		},
	});

	const groupReorderMutation = useMutation({
		...orpc.taskGroups.reorder.mutationOptions(),
		onMutate: async (input) => {
			await queryClient.cancelQueries({ predicate: (q) => isTaskGroupsQueryKey(q.queryKey) });
			const previous = queryClient.getQueriesData({
				predicate: (q) => isTaskGroupsQueryKey(q.queryKey),
			});
			// A ordem de render dos grupos vem da ordem do array; reordenar o array já reflete o
			// arraste. O display_order correto chega no refetch do onSettled.
			const rank = new Map(input.orderedIds.map((id, index) => [id, index]));

			queryClient.setQueriesData<TaskGroup[]>(
				{ predicate: (q) => isTaskGroupsQueryKey(q.queryKey) },
				(old) => {
					if (!Array.isArray(old)) return old;
					return [...old].sort(
						(a, b) => (rank.get(a.id) ?? old.length) - (rank.get(b.id) ?? old.length),
					);
				},
			);
			return { previous };
		},
		onError: (_error, _input, context) => {
			for (const [key, data] of context?.previous ?? []) {
				queryClient.setQueryData(key, data);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ predicate: (q) => isTaskGroupsQueryKey(q.queryKey) });
		},
	});

	function resolveTargetBucket(overId: string): string | null {
		if (overId.startsWith("group::")) {
			const rawGroup = overId.slice("group::".length);
			const groupId = rawGroup === NO_GROUP ? null : rawGroup;
			return groupId ?? NO_GROUP;
		}

		const overTask = taskMap.get(overId);
		if (!overTask) return null;
		return overTask.groupId ?? NO_GROUP;
	}

	function persistBucket(targetKey: string, orderedIds: string[]) {
		const groupId = targetKey === NO_GROUP ? null : targetKey;
		reorderMutation.mutate({
			groupId,
			orderedIds,
		});
	}

	// Reordena os slots de grupo. O arraste de grupo só colide com cabeçalhos de grupo, então ambos
	// os ids chegam como `group::<x>`. O "Sem grupo" (slot null) participa: a posição dele vira
	// preferência de UI (`noGroupOrder`) e os grupos reais persistem o display_order no banco.
	function handleGroupDragEnd(activeDropId: string, overDropId: string) {
		const activeSlot = slotFromGroupDropId(activeDropId);
		const overSlot = slotFromGroupDropId(overDropId);
		if (activeSlot === overSlot) return;

		const order = renderableGroups.map((slot) => slot.id);
		const oldIndex = order.indexOf(activeSlot);
		const newIndex = order.indexOf(overSlot);
		if (oldIndex < 0 || newIndex < 0) return;

		const moved = arrayMove(order, oldIndex, newIndex);
		const visibleSlots = new Set(order);
		let visibleIndex = 0;
		const fullOrder: (string | null)[] = groups.map((group) => group.id);
		fullOrder.splice(Math.min(Math.max(noGroupOrder, 0), fullOrder.length), 0, null);
		const mergedOrder = fullOrder.map((slot) => {
			if (!visibleSlots.has(slot)) return slot;

			const next = moved[visibleIndex];
			visibleIndex += 1;
			return next;
		});

		const nullIndex = mergedOrder.indexOf(null);
		if (nullIndex >= 0) setNoGroupOrder(nullIndex);

		const realOrder = mergedOrder.filter((id): id is string => id !== null);
		const prevRealOrder = groups.map((group) => group.id);
		if (realOrder.some((id, index) => id !== prevRealOrder[index])) {
			groupReorderMutation.mutate({ orderedIds: realOrder });
		}
	}

	function handleDragStart(event: DragStartEvent) {
		setActiveId(String(event.active.id));
	}

	// Toda a lógica acontece no drop (mexer em estado durante o arraste dispara loops de
	// re-medição do dnd-kit em multi-container). O cache otimista reflete a mudança na hora.
	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		setActiveId(null);

		if (!over || String(over.id) === String(active.id)) return;

		if (active.data.current?.type === "group") {
			handleGroupDragEnd(String(active.id), String(over.id));
			return;
		}

		const activeTask = taskMap.get(String(active.id));
		if (!activeTask) return;

		const fromKey = activeTask.groupId ?? NO_GROUP;
		const targetKey = resolveTargetBucket(String(over.id));
		if (!targetKey) return;

		if (targetKey === fromKey) {
			const ids = [...(buckets[fromKey] ?? [])];
			const oldIndex = ids.indexOf(activeTask.id);
			const newIndex = ids.indexOf(String(over.id));
			if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;

			persistBucket(fromKey, arrayMove(ids, oldIndex, newIndex));
			return;
		}

		const targetIds = (buckets[targetKey] ?? []).filter((id) => id !== activeTask.id);
		const overIndex = targetIds.indexOf(String(over.id));
		const insertAt = overIndex >= 0 ? overIndex : targetIds.length;
		targetIds.splice(insertAt, 0, activeTask.id);

		persistBucket(targetKey, targetIds);
	}

	if (loading) {
		return (
			<Text size="sm" tone="muted">
				Carregando tarefas...
			</Text>
		);
	}

	const sortableGroupIds = renderableGroups.map((slot) => groupDropId(slot.id));
	const isGroupDrag = !!activeId?.startsWith("group::");
	const activeGroup = isGroupDrag
		? groups.find((group) => groupDropId(group.id) === activeId)
		: undefined;

	return (
		<DndContext
			sensors={sensors}
			// Arraste de grupo só colide com seções de grupo; senão o ponteiro cairia numa task
			// alta do grupo de destino e o arraste ficaria grudento, sem feedback de onde encaixa.
			collisionDetection={(args) =>
				args.active.data.current?.type === "group"
					? closestCorners({
							...args,
							droppableContainers: args.droppableContainers.filter((c) =>
								String(c.id).startsWith("group::"),
							),
						})
					: closestCorners(args)
			}
			onDragStart={handleDragStart}
			onDragEnd={handleDragEnd}
			onDragCancel={() => setActiveId(null)}
		>
			<SortableContext items={sortableGroupIds} strategy={verticalListSortingStrategy}>
				<div className="flex flex-col gap-5">
					{renderableGroups.map(({ id, group, bucketKeys, count }) => {
						// Grupos reais usam o próprio id (UUID único entre projetos); só o "Sem feature"
						// (id null) ganha o prefixo do projeto pra não colapsar junto em "Todos".
						const collapseKey = id ?? noGroupKey(collapseKeyPrefix);

						// Todo slot (inclusive "Sem grupo") arrasta para reordenar e recebe tasks.
						return (
							<SortableGroupSection
								key={id ?? NO_GROUP}
								groupId={id}
								group={group}
								count={count}
								bucketKeys={bucketKeys}
								buckets={buckets}
								taskMap={taskMap}
								highlightLevels={highlightLevels}
								features={availableFeatures}
								reorderingDisabled={reorderingDisabled}
								collapsed={collapsedKeys.includes(collapseKey)}
								onToggleCollapse={() => toggleCollapsed(collapseKey)}
							/>
						);
					})}

					{tasks.length === 0 && (
						<Text size="sm" tone="muted">
							Nenhuma tarefa encontrada. Crie uma nova acima.
						</Text>
					)}
				</div>
			</SortableContext>

			<DragOverlay dropAnimation={null}>
				{isGroupDrag ? (
					<div className="border border-border bg-popover px-3 py-2 shadow-lg">
						<div className="flex items-center gap-2">
							{activeGroup && (
								<span
									className="size-2.5 shrink-0 rounded-full"
									style={{ backgroundColor: activeGroup.color }}
								/>
							)}
							<Text
								size="sm"
								className={cn("truncate font-medium", !activeGroup && "text-muted-foreground")}
							>
								{activeGroup?.name ?? "Sem feature"}
							</Text>
						</div>
					</div>
				) : activeId && taskMap.get(activeId) ? (
					<div className="shadow-lg">
						<TaskItem task={taskMap.get(activeId)!} variant="default" />
					</div>
				) : null}
			</DragOverlay>
		</DndContext>
	);
}

// Visão "Todos os projetos": projeto → feature → tasks. Cada projeto reaproveita uma instância
// inteira de GroupedTaskList com a sua fatia de tasks/groups. Como cada GroupedTaskList monta o
// próprio DndContext, o arraste fica confinado ao projeto (reorder/move nunca cruza projetos) e
// os payloads de reorder carregam só os ids daquele projeto — idênticos aos do modo single.
interface GroupedTaskListByProjectProps extends GroupedTaskListProps {
	projects: { id: string; name: string; color: string; displayOrder: number }[];
}

export function GroupedTaskListByProject({
	tasks,
	groups,
	loading,
	sortMode,
	reorderingDisabled,
	projects,
}: GroupedTaskListByProjectProps) {
	const [collapsedProjects, setCollapsedProjects] = useState<string[]>([]);
	const tasksByProject = useMemo(() => Map.groupBy(tasks, (task) => task.projectId), [tasks]);
	const groupsByProject = useMemo(() => Map.groupBy(groups, (group) => group.projectId), [groups]);

	if (loading) {
		return (
			<Text size="sm" tone="muted">
				Carregando tarefas...
			</Text>
		);
	}

	const visibleProjects = [...projects]
		.sort((a, b) => a.displayOrder - b.displayOrder)
		.filter((project) => (tasksByProject.get(project.id)?.length ?? 0) > 0);

	if (visibleProjects.length === 0) {
		return (
			<Text size="sm" tone="muted">
				Nenhuma tarefa encontrada. Crie uma nova acima.
			</Text>
		);
	}

	return (
		<div className="flex flex-col gap-8">
			{visibleProjects.map((project) => {
				const collapsed = collapsedProjects.includes(project.id);
				const ProjectChevron = collapsed ? ChevronRight : ChevronDown;
				return (
					<section key={project.id} className="flex flex-col gap-3">
						<button
							type="button"
							className="flex items-center gap-2 border-b border-border py-2 text-left"
							onClick={() =>
								setCollapsedProjects((current) =>
									current.includes(project.id)
										? current.filter((id) => id !== project.id)
										: [...current, project.id],
								)
							}
							aria-expanded={!collapsed}
						>
							<ProjectChevron className="size-4 text-muted-foreground" />
							<span
								className="size-2.5 shrink-0 rounded-full"
								style={{ backgroundColor: project.color }}
							/>
							<Text size="sm" className="font-semibold">
								{project.name}
							</Text>
							<span className="ml-auto text-xs tabular-nums text-muted-foreground">
								{tasksByProject.get(project.id)?.length ?? 0}
							</span>
						</button>
						{!collapsed && (
							<GroupedTaskList
								tasks={tasksByProject.get(project.id) ?? []}
								groups={groupsByProject.get(project.id) ?? []}
								availableFeatures={groupsByProject.get(project.id) ?? []}
								loading={false}
								sortMode={sortMode}
								reorderingDisabled={reorderingDisabled}
								collapseKeyPrefix={project.id}
							/>
						)}
					</section>
				);
			})}
		</div>
	);
}

type GroupSectionProps = {
	groupId: string | null;
	group?: TaskGroup;
	count: number;
	bucketKeys: string[];
	buckets: Record<string, string[]>;
	taskMap: Map<string, Task>;
	highlightLevels: Map<string, number>;
	features: TaskGroup[];
	reorderingDisabled: boolean;
	collapsed: boolean;
	onToggleCollapse: () => void;
};

// Grupo nomeado: arrasta (handle no cabeçalho) para reordenar e recebe tasks (o ref do sortable
// já é droppable). O id "group::<id>" casa com a resolução de drop de tasks sobre o cabeçalho.
function SortableGroupSection({ groupId, reorderingDisabled, ...rest }: GroupSectionProps) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: groupDropId(groupId),
		data: { type: "group" },
		disabled: reorderingDisabled,
	});

	const style: React.CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition: isDragging ? undefined : transition,
		opacity: isDragging ? 0.4 : 1,
	};

	const dragHandle = (
		<button
			type="button"
			aria-label="Arrastar feature"
			disabled={reorderingDisabled}
			className="cursor-grab touch-none p-0.5 text-muted-foreground/40 opacity-0 transition-opacity hover:text-foreground group-hover/header:opacity-100 focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-20"
			{...attributes}
			{...(listeners as React.HTMLAttributes<HTMLButtonElement>)}
		>
			<GripVertical className="size-4" />
		</button>
	);

	return (
		<GroupSectionBody
			{...rest}
			reorderingDisabled={reorderingDisabled}
			setNodeRef={setNodeRef}
			style={style}
			dragHandle={dragHandle}
		/>
	);
}

function GroupSectionBody({
	group,
	count,
	bucketKeys,
	buckets,
	taskMap,
	highlightLevels,
	features,
	reorderingDisabled,
	collapsed,
	onToggleCollapse,
	setNodeRef,
	style,
	dragHandle,
}: Omit<GroupSectionProps, "groupId"> & {
	setNodeRef: (node: HTMLElement | null) => void;
	style?: React.CSSProperties;
	dragHandle?: React.ReactNode;
}) {
	const allIds = bucketKeys.flatMap((key) => buckets[key]);

	return (
		<section ref={setNodeRef} style={style} className="flex flex-col gap-2">
			<TaskGroupHeader
				group={group}
				count={count}
				collapsed={collapsed}
				onToggleCollapse={onToggleCollapse}
				dragHandle={dragHandle}
			/>

			{!collapsed && (
				<SortableContext items={allIds} strategy={verticalListSortingStrategy}>
					<div className="flex flex-col gap-0 px-4">
						{bucketKeys.map((key) =>
							buckets[key].map((taskId) => {
								const task = taskMap.get(taskId);
								if (!task) return null;
								return (
									<SortableTaskRow
										key={taskId}
										task={task}
										highlight={highlightLevels.get(taskId)}
										features={features}
										reorderingDisabled={reorderingDisabled}
									/>
								);
							}),
						)}
					</div>
				</SortableContext>
			)}
		</section>
	);
}

function SortableTaskRow({
	task,
	highlight,
	features,
	reorderingDisabled,
}: {
	task: Task;
	highlight?: number;
	features: TaskGroup[];
	reorderingDisabled: boolean;
}) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: task.id,
		data: { task },
		disabled: reorderingDisabled,
	});

	const style: React.CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition: isDragging ? undefined : transition,
		opacity: isDragging ? 0 : 1,
	};

	return (
		<div ref={setNodeRef} style={style} className="flex items-center gap-1">
			<button
				type="button"
				aria-label="Arrastar tarefa"
				disabled={reorderingDisabled}
				className="hidden cursor-grab touch-none p-1 text-muted-foreground/50 transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-20 md:flex"
				{...attributes}
				{...(listeners as React.HTMLAttributes<HTMLButtonElement>)}
			>
				<GripVertical className="size-4" />
			</button>
			<div className="min-w-0 flex-1">
				<TaskItem task={task} variant="default" highlight={highlight} features={features} />
			</div>
		</div>
	);
}
