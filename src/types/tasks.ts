import type { RouterOutputs } from "@/client";

type Task = RouterOutputs["tasks"]["listByProject"][number];
export type TaskFull = RouterOutputs["tasks"]["getFull"];
export type SubtaskFull = NonNullable<NonNullable<TaskFull>["subtasks"]>[number];

export type TaskWithMeta = Omit<Task, "categoryId" | "priorityId"> & {
	categoryId: string;
	priorityId: string;
	category: { id: string; name: string; color: string };
	priority: { id: string; name: string; color: string };
	statusLabel: string;
};
