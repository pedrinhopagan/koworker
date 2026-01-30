import type { subtasks } from "@/api/db/connection";

export type Subtask = subtasks;

export type SubtaskStatus = Subtask["status"];
