import type { RouterOutputs } from "@/client";

export type Task = RouterOutputs["tasks"]["getAll"][number];
export type TaskGroup = RouterOutputs["taskGroups"]["list"][number];
export type TaskFull = RouterOutputs["tasks"]["getFull"];
export type TaskFile = NonNullable<TaskFull>["files"][number];

export type TaskWithMeta = Task & {
	category: { id: string; name: string; color: string };
	priority: { id: string; name: string; color: string };
};
