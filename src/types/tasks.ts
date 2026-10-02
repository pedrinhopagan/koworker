import type { RouterOutputs } from "@/client";

export type Task = RouterOutputs["tasks"]["getAll"][number];
export type TaskGroup = RouterOutputs["taskGroups"]["list"][number];
export type TaskFull = RouterOutputs["tasks"]["getFull"];
export type TaskFile = NonNullable<TaskFull>["files"][number];
