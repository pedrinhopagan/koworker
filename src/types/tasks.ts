import type { RouterOutputs } from "@/client";

export type Task = RouterOutputs["tasks"]["getAll"][number];
export type TaskGroup = RouterOutputs["taskGroups"]["list"][number];
export type TaskFull = RouterOutputs["tasks"]["getFull"];
export type TaskFile = NonNullable<TaskFull>["files"][number];

export type TaskWithMeta = Task & {
	// Prioridade e categoria são opcionais: uma task pode não ter nenhuma das duas.
	category: { id: string; name: string; color: string } | null;
	priority: { id: string; name: string; color: string } | null;
};
