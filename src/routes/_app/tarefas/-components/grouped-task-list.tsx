import {
	closestCorners,
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	KeyboardSensor,
	PointerSensor,
	useDroppable,
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
import { GripVertical } from "lucide-react";
import { useMemo, useState } from "react";

import { orpc } from "@/client";
import { TaskItem } from "@/components/tasks";
import { Text } from "@/components/typography";
import { RECENCY_FRESH_WINDOW_MS, RECENCY_HIGHLIGHT_DEPTH } from "@/constants/tasks";
import type { TaskGroup, TaskWithMeta } from "@/types/tasks";
import {
	type SortMode,
	TaskGroupHeader,
	TaskGroupsToolbar,
	useSortMode,
} from "./task-groups-controls";

const NO_GROUP = "__none__";
// Categoria sentinela dos buckets "achatados" (modos que não clusterizam por categoria).
const FLAT_CAT = "__all__";

function bucketKey(groupId: string | null, categoryId: string) {
	return `${groupId ?? NO_GROUP}::${categoryId}`;
}

function parseBucketKey(key: string): { groupId: string | null; categoryId: string } {
	const [group, categoryId] = key.split("::");
	return { groupId: group === NO_GROUP ? null : group, categoryId };
}

function isTasksQueryKey(queryKey: QueryKey) {
	return Array.isArray(queryKey) && Array.isArray(queryKey[0]) && queryKey[0][0] === "tasks";
}

type SortContext = {
	mode: SortMode;
	categoryOrder: Map<string, number>;
	priorityLevel: Map<string, number>;
};

// O bucket de uma task depende do modo: por categoria clusteriza (grupo+categoria); nos demais
// o grupo é um bucket único e a categoria não separa.
function taskBucketKey(task: TaskWithMeta, mode: SortMode) {
	const groupId = task.groupId ?? null;
	return mode === "categoria" ? bucketKey(groupId, task.categoryId) : bucketKey(groupId, FLAT_CAT);
}

// Comparador dentro do bucket. Concluídas sempre afundam; depois vem a chave do modo; o
// display_order (ordem manual do arraste) é sempre o desempate.
function compareInBucket(a: TaskWithMeta, b: TaskWithMeta, ctx: SortContext) {
	if (a.done !== b.done) return a.done ? 1 : -1;

	if (ctx.mode === "prioridade") {
		// level menor = mais importante (Alta=1), igual ao critério de getFocusTask.
		const la = ctx.priorityLevel.get(a.priorityId) ?? Number.MAX_SAFE_INTEGER;
		const lb = ctx.priorityLevel.get(b.priorityId) ?? Number.MAX_SAFE_INTEGER;
		if (la !== lb) return la - lb;
	} else if (ctx.mode === "recente") {
		if (a.lastEditedAt !== b.lastEditedAt) return b.lastEditedAt - a.lastEditedAt;
	} else if (ctx.mode === "alfabetica") {
		const cmp = a.displayTitle.localeCompare(b.displayTitle, "pt-BR");
		if (cmp !== 0) return cmp;
	}

	if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
	return b.createdAt - a.createdAt;
}

function buildBuckets(tasks: TaskWithMeta[], ctx: SortContext) {
	const sorted = [...tasks].sort((a, b) => compareInBucket(a, b, ctx));

	const buckets: Record<string, string[]> = {};
	for (const task of sorted) {
		(buckets[taskBucketKey(task, ctx.mode)] ??= []).push(task.id);
	}
	return buckets;
}

// Top-N tarefas pendentes por última edição → nível de destaque (1 = mais recente). O ranking é
// por projeto (a visão "Todos os projetos" não deixa uma task de um projeto roubar o destaque de
// outro): cada projeto tem seus próprios top-N. Só entram tarefas editadas dentro da janela de
// frescor — destacar uma parada há meses seria chamar de "recente" o que não é.
function buildHighlightLevels(tasks: TaskWithMeta[]) {
	const freshFloor = Date.now() - RECENCY_FRESH_WINDOW_MS;

	const byProject = new Map<string, TaskWithMeta[]>();
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
			.slice(0, RECENCY_HIGHLIGHT_DEPTH)
			.forEach((task, index) => levels.set(task.id, index + 1));
	}
	return levels;
}

type GroupedTaskListProps = {
	tasks: TaskWithMeta[];
	groups: TaskGroup[];
	categories: { id: string; displayOrder: number }[];
	priorities: { id: string; level: number }[];
	projectId: string | null;
	loading: boolean;
};

export function GroupedTaskList({
	tasks,
	groups,
	categories,
	priorities,
	projectId,
	loading,
}: GroupedTaskListProps) {
	const queryClient = useQueryClient();
	const [activeId, setActiveId] = useState<string | null>(null);
	const [sortMode, setSortMode] = useSortMode();

	const sortCtx = useMemo<SortContext>(
		() => ({
			mode: sortMode,
			categoryOrder: new Map(categories.map((c) => [c.id, c.displayOrder])),
			priorityLevel: new Map(priorities.map((p) => [p.id, p.level])),
		}),
		[sortMode, categories, priorities],
	);
	const taskMap = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

	const buckets = useMemo(() => buildBuckets(tasks, sortCtx), [tasks, sortCtx]);
	const highlightLevels = useMemo(() => buildHighlightLevels(tasks), [tasks]);

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

			queryClient.setQueriesData<TaskWithMeta[]>(
				{ predicate: (q) => isTasksQueryKey(q.queryKey) },
				(old) => {
					if (!Array.isArray(old)) return old;
					return old.map((task) => {
						const index = orderIndex.get(task.id);
						if (index === undefined) return task;
						return {
							...task,
							groupId: input.groupId ?? undefined,
							...(input.categoryId ? { categoryId: input.categoryId } : {}),
							displayOrder: index,
						};
					});
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
			queryClient.invalidateQueries({ predicate: (q) => isTasksQueryKey(q.queryKey) });
		},
	});

	// Resolve, para um `over.id`, o bucket de destino conforme o modo. Sobre um cabeçalho de
	// grupo, mantém a categoria da task ativa; sobre uma task, usa o bucket dela.
	function resolveTargetBucket(overId: string, active: TaskWithMeta): string | null {
		if (overId.startsWith("group::")) {
			const rawGroup = overId.slice("group::".length);
			const groupId = rawGroup === NO_GROUP ? null : rawGroup;
			return sortMode === "categoria"
				? bucketKey(groupId, active.categoryId)
				: bucketKey(groupId, FLAT_CAT);
		}
		if (overId.includes("::")) return overId;

		const overTask = taskMap.get(overId);
		if (!overTask) return null;
		return taskBucketKey(overTask, sortMode);
	}

	function persistBucket(targetKey: string, orderedIds: string[]) {
		const { groupId, categoryId } = parseBucketKey(targetKey);
		reorderMutation.mutate({
			groupId,
			categoryId: categoryId === FLAT_CAT ? undefined : categoryId,
			orderedIds,
		});
	}

	function handleDragStart(event: DragStartEvent) {
		setActiveId(String(event.active.id));
	}

	// Toda a lógica acontece no drop (mexer em estado durante o arraste dispara loops de
	// re-medição do dnd-kit em multi-container). O cache otimista reflete a mudança na hora.
	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		setActiveId(null);

		const activeTask = taskMap.get(String(active.id));
		if (!activeTask || !over || String(over.id) === String(active.id)) return;

		const fromKey = taskBucketKey(activeTask, sortMode);
		const targetKey = resolveTargetBucket(String(over.id), activeTask);
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

	const groupOrder: { id: string | null; group?: TaskGroup }[] = [
		...groups.map((group) => ({ id: group.id, group })),
		{ id: null },
	];

	return (
		<div className="flex flex-col gap-4">
			<TaskGroupsToolbar projectId={projectId} sortMode={sortMode} onSortModeChange={setSortMode} />

			<DndContext
				sensors={sensors}
				collisionDetection={closestCorners}
				onDragStart={handleDragStart}
				onDragEnd={handleDragEnd}
				onDragCancel={() => setActiveId(null)}
			>
				<div className="flex flex-col gap-5">
					{groupOrder.map(({ id, group }) => {
						const groupBucketKeys = Object.keys(buckets)
							.filter((key) => parseBucketKey(key).groupId === id)
							.sort(
								(a, b) =>
									(sortCtx.categoryOrder.get(parseBucketKey(a).categoryId) ?? 0) -
									(sortCtx.categoryOrder.get(parseBucketKey(b).categoryId) ?? 0),
							);
						const groupTaskCount = groupBucketKeys.reduce(
							(sum, key) => sum + buckets[key].length,
							0,
						);

						// "Sem grupo" só aparece quando tem task; grupos nomeados sempre aparecem.
						if (id === null && groupTaskCount === 0) return null;

						return (
							<GroupSection
								key={id ?? NO_GROUP}
								groupId={id}
								group={group}
								count={groupTaskCount}
								bucketKeys={groupBucketKeys}
								buckets={buckets}
								taskMap={taskMap}
								highlightLevels={highlightLevels}
							/>
						);
					})}

					{tasks.length === 0 && (
						<Text size="sm" tone="muted">
							Nenhuma tarefa encontrada. Crie uma nova acima.
						</Text>
					)}
				</div>

				<DragOverlay dropAnimation={null}>
					{activeId && taskMap.get(activeId) ? (
						<div className="shadow-lg">
							<TaskItem task={taskMap.get(activeId)!} variant="default" />
						</div>
					) : null}
				</DragOverlay>
			</DndContext>
		</div>
	);
}

type GroupSectionProps = {
	groupId: string | null;
	group?: TaskGroup;
	count: number;
	bucketKeys: string[];
	buckets: Record<string, string[]>;
	taskMap: Map<string, TaskWithMeta>;
	highlightLevels: Map<string, number>;
};

function GroupSection({
	groupId,
	group,
	count,
	bucketKeys,
	buckets,
	taskMap,
	highlightLevels,
}: GroupSectionProps) {
	const [collapsed, setCollapsed] = useState(false);
	const { setNodeRef } = useDroppable({ id: `group::${groupId ?? NO_GROUP}` });

	const allIds = bucketKeys.flatMap((key) => buckets[key]);

	return (
		<section ref={setNodeRef} className="flex flex-col gap-2">
			<TaskGroupHeader
				group={group}
				count={count}
				collapsed={collapsed}
				onToggleCollapse={() => setCollapsed((value) => !value)}
			/>

			{!collapsed && (
				<SortableContext items={allIds} strategy={verticalListSortingStrategy}>
					<div className="flex flex-col gap-1.5">
						{bucketKeys.map((key) =>
							buckets[key].map((taskId) => {
								const task = taskMap.get(taskId);
								if (!task) return null;
								return (
									<SortableTaskRow
										key={taskId}
										task={task}
										highlight={highlightLevels.get(taskId)}
									/>
								);
							}),
						)}
						{count === 0 && (
							<Text size="sm" tone="muted" className="px-3 py-2">
								Arraste tarefas para cá.
							</Text>
						)}
					</div>
				</SortableContext>
			)}
		</section>
	);
}

function SortableTaskRow({ task, highlight }: { task: TaskWithMeta; highlight?: number }) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: task.id,
		data: { task },
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
				className="cursor-grab touch-none p-1 text-muted-foreground/50 transition-colors hover:text-foreground"
				{...attributes}
				{...(listeners as React.HTMLAttributes<HTMLButtonElement>)}
			>
				<GripVertical className="size-4" />
			</button>
			<div className="min-w-0 flex-1">
				<TaskItem task={task} variant="default" highlight={highlight} />
			</div>
		</div>
	);
}
