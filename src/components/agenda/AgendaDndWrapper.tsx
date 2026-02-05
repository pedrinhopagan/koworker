import {
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	MouseSensor,
	TouchSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";

import { orpc } from "@/client";
import type { TaskWithMeta } from "@/types/tasks";
import { WeekTaskChip } from "./WeekTaskChip";

type AgendaDndWrapperProps = {
	children: ReactNode;
	onTasksChanged?: () => void;
};

export function AgendaDndWrapper({ children, onTasksChanged }: AgendaDndWrapperProps) {
	const queryClient = useQueryClient();
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

	const updateTaskMutation = useMutation({
		...orpc.tasks.update.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["tasks"] });
			onTasksChanged?.();
		},
	});

	function handleDragStart(event: DragStartEvent) {
		const { active } = event;
		const task = active.data.current?.task as TaskWithMeta | undefined;
		if (task) {
			setActiveTask(task);
		}
	}

	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		setActiveTask(null);

		if (!over) return;

		const task = active.data.current?.task as TaskWithMeta | undefined;
		const targetDate = over.data.current?.date as string | undefined;

		if (!task || !targetDate) return;
		if (task.scheduledDate === targetDate) return;

		updateTaskMutation.mutate(
			{ id: task.id, scheduledDate: targetDate },
			{
				onError: (e) => console.error("Failed to reschedule task:", e),
			},
		);
	}

	return (
		<DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
			{children}
			<DragOverlay>
				{activeTask && (
					<div className="rounded bg-background p-1 shadow-lg">
						<WeekTaskChip task={activeTask} />
					</div>
				)}
			</DragOverlay>
		</DndContext>
	);
}
