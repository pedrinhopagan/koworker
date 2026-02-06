import {
	type CollisionDetection,
	DndContext,
	type DragCancelEvent,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	MouseSensor,
	pointerWithin,
	rectIntersection,
	TouchSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import { type QueryKey, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { orpc } from "@/client";
import { TaskItem } from "@/components/tasks";
import { useProjectFocus } from "@/hooks";
import type { TaskWithMeta } from "@/types/tasks";
import { getNextAvailableSlot } from "./time-slots";

type AgendaDndWrapperProps = {
	children: ReactNode;
	onTasksChanged?: () => void;
};

type TaskListCache = Array<{
	id: string;
	scheduledDate?: string | null;
	scheduledTime?: string | null;
}>;

function isTasksQueryKey(queryKey: QueryKey) {
	return Array.isArray(queryKey) && Array.isArray(queryKey[0]) && queryKey[0][0] === "tasks";
}

export function AgendaDndWrapper({ children, onTasksChanged }: AgendaDndWrapperProps) {
	const queryClient = useQueryClient();
	const { selectedProjectId } = useProjectFocus();
	const [activeTask, setActiveTask] = useState<TaskWithMeta | null>(null);

	const sensors = useSensors(
		useSensor(MouseSensor, {
			activationConstraint: {
				distance: 8,
			},
		}),
		useSensor(TouchSensor, {
			activationConstraint: {
				delay: 200,
				tolerance: 5,
			},
		}),
	);

	const collisionDetection = useMemo<CollisionDetection>(
		() => (args) => {
			const pointerCollisions = pointerWithin(args);
			if (pointerCollisions.length > 0) {
				return pointerCollisions;
			}

			return rectIntersection(args);
		},
		[],
	);

	const updateTaskMutation = useMutation({
		...orpc.tasks.update.mutationOptions(),
		onMutate: async (input) => {
			const tasksQueryFilter = {
				predicate: (query: { queryKey: QueryKey }) => isTasksQueryKey(query.queryKey),
			};

			await queryClient.cancelQueries(tasksQueryFilter);
			const previous = queryClient.getQueriesData<TaskListCache>(tasksQueryFilter);

			queryClient.setQueriesData<TaskListCache>(tasksQueryFilter, (old) => {
				if (!Array.isArray(old)) return old;

				return old.map((task) => {
					if (!task || task.id !== input.id) return task;

					return {
						...task,
						scheduledDate: input.scheduledDate ?? null,
						scheduledTime: input.scheduledTime ?? null,
					};
				});
			});

			onTasksChanged?.();

			return { previous };
		},
		onError: (_error, _variables, context) => {
			for (const [queryKey, data] of context?.previous ?? []) {
				queryClient.setQueryData(queryKey, data);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({
				predicate: (query) => isTasksQueryKey(query.queryKey),
			});
			onTasksChanged?.();
		},
	});

	function handleDragStart(event: DragStartEvent) {
		const { active } = event;
		const task = active.data.current?.task as TaskWithMeta | undefined;

		document.body.style.cursor = "grabbing";
		document.documentElement.style.cursor = "grabbing";

		if (task) {
			setActiveTask(task);
		}
	}

	function resetDragUiState() {
		setActiveTask(null);
		document.body.style.removeProperty("cursor");
		document.documentElement.style.removeProperty("cursor");
	}

	function handleDragCancel(_event: DragCancelEvent) {
		resetDragUiState();
	}

	async function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		resetDragUiState();

		if (!over) return;

		const task = active.data.current?.task as TaskWithMeta | undefined;
		const dropType = over.data.current?.type as string | undefined;
		const targetDate = over.data.current?.date as string | undefined;

		if (!task) return;

		if (dropType === "unscheduled-target") {
			if (!task.scheduledDate) return;

			updateTaskMutation.mutate(
				{ id: task.id, scheduledDate: null, scheduledTime: null },
				{
					onError: (e) => console.error("Failed to unschedule task:", e),
				},
			);
			return;
		}

		if (!targetDate) return;
		if (task.scheduledDate === targetDate) return;

		try {
			const dayTasks = await queryClient.fetchQuery(
				orpc.tasks.getAll.queryOptions({
					input: {
						date: targetDate,
						projectId: selectedProjectId ?? null,
						includeCompleted: false,
					},
				}),
			);

			const scheduledTime = getNextAvailableSlot(dayTasks, task.id);

			updateTaskMutation.mutate(
				{ id: task.id, scheduledDate: targetDate, scheduledTime },
				{
					onError: (e) => console.error("Failed to reschedule task:", e),
				},
			);
		} catch (error) {
			console.error("Failed to fetch day tasks:", error);
		}
	}

	return (
		<DndContext
			sensors={sensors}
			modifiers={[snapCenterToCursor]}
			collisionDetection={collisionDetection}
			onDragStart={handleDragStart}
			onDragCancel={handleDragCancel}
			onDragEnd={handleDragEnd}
		>
			{children}
			<DragOverlay dropAnimation={null}>
				{activeTask && (
					<div className="w-[89px] cursor-grabbing rounded-md bg-background/95 p-0.5 shadow-lg">
						<TaskItem task={activeTask} variant="agendaMini" />
					</div>
				)}
			</DragOverlay>
		</DndContext>
	);
}
