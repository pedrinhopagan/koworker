import type { BadgeVariant } from "@/components/ui/badge";

export type TaskStatus = "pending" | "in_execution" | "executed";

export type TaskStatusOption = {
	id: TaskStatus;
	label: string;
};

export const statusLabels: Record<TaskStatus, string> = {
	pending: "Pendente",
	in_execution: "Em execução",
	executed: "Executada",
};

export const statusVariants: Record<TaskStatus, BadgeVariant> = {
	pending: "muted",
	in_execution: "warning",
	executed: "success",
};

export function getStatusLabel(status: string): string {
	return statusLabels[status as TaskStatus] ?? status;
}

export function getStatusVariant(status: string): BadgeVariant {
	return statusVariants[status as TaskStatus] ?? "muted";
}

export function getTaskStatusOptions(): TaskStatusOption[] {
	return (Object.entries(statusLabels) as [TaskStatus, string][]).map(([id, label]) => ({
		id,
		label,
	}));
}
