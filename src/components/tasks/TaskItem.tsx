import { Loader2 } from "lucide-react";
import { tv, type VariantProps } from "tailwind-variants";
import { Title } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { deriveTaskAttentionState } from "@/domain/tasks/attention";
import { cn } from "@/lib/utils";
import type { TaskWithMeta } from "@/types/tasks";

const taskItemVariants = tv({
	base: "flex items-center justify-between gap-4 border border-transparent bg-card transition-all duration-200 hover:border-border hover:bg-secondary/30 animate-fade-in w-full truncate",
	variants: {
		variant: {
			default: "px-3 py-2",
			compact: "px-3 py-1.5",
		},
	},
	defaultVariants: {
		variant: "default",
	},
});

const statusVariants = {
	pending: "muted",
	in_execution: "warning",
	executed: "success",
} as const;

export type TaskItemVariant = VariantProps<typeof taskItemVariants>["variant"];

type TaskItemProps = {
	task: TaskWithMeta;
	variant?: TaskItemVariant;
};

function normalizeStatus(status: unknown): "pending" | "in_execution" | "executed" {
	// Compat com dados legados no DB
	switch (status) {
		case "done":
			return "executed";
		case "in_progress":
			return "in_execution";
		case "pending":
		case "in_execution":
		case "executed":
			return status;
		default:
			return "pending";
	}
}

export function TaskItem({ task, variant = "default" }: TaskItemProps) {
	const isDone = task.status === "executed";
	const statusVariant = statusVariants[task.status] ?? "muted";

	const subtasks = task.subtasks ?? [];
	const firstNotCompleted = subtasks.find((st) => {
		const s = normalizeStatus(st.status);
		return s !== "executed";
	});
	const firstNotCompletedStatus = firstNotCompleted
		? normalizeStatus(firstNotCompleted.status)
		: null;

	const attention = deriveTaskAttentionState({
		status: task.status,
		description: task.description,
		aiMetadata: task.aiMetadata as { lastCompletedAction?: string | null } | null,
		subtasks,
	});

	// Estado “máximo” (vermelho + roxo + spinner): pai em execução E primeira subtask também em execução
	const isMaxAttention =
		(task.status === "in_execution" && firstNotCompletedStatus === "in_execution") ||
		attention.shouldSpin;

	const containerStyle: React.CSSProperties | undefined = isMaxAttention
		? {
				backgroundImage:
					"linear-gradient(90deg, rgba(239, 68, 68, 0.16), rgba(168, 85, 247, 0.14))",
				borderColor: "rgba(239, 68, 68, 0.35)",
			}
		: {
				borderColor: `${task.priority.color}30`,
			};

	return (
		<div
			className={cn(
				taskItemVariants({ variant }),
				"border",
				attention.shouldPulse && "animate-pulse",
				attention.requiresAttention && "hover:bg-secondary/40",
			)}
			style={containerStyle}
			data-attention={attention.progressState}
		>
			<div className="flex min-w-0 items-center gap-3 flex-1">
				<span className={cn("text-muted-foreground transition-colors", isDone && "text-primary")}>
					{isDone ? "[x]" : "[ ]"}
				</span>
				<Title
					as="span"
					size="sm"
					className={cn(
						"truncate text-sm font-normal max-w-2xl",
						isDone && "line-through text-muted-foreground",
					)}
				>
					{task.title}
				</Title>
			</div>

			<div className="flex flex-1 self-end justify-end shrink-0 items-center gap-2">
				{isMaxAttention ? (
					<Loader2 size={14} className="animate-spin text-purple-300" />
				) : attention.shouldSpin ? (
					<Loader2 size={14} className="animate-spin text-muted-foreground" />
				) : null}

				{/* Badge principal: estado derivado/atenção */}
				<Badge
					variant={statusVariant}
					className="shrink-0"
					style={{
						backgroundColor: `${attention.color}20`,
						color: attention.color,
					}}
				>
					{attention.label}
				</Badge>

				{/* Categoria/Tipo */}
				<Badge
					variant="muted"
					className="shrink-0"
					style={{
						backgroundColor: `${task.category.color}20`,
						color: task.category.color,
					}}
				>
					{task.category.name}
				</Badge>

				{/* Prioridade: define cor base (mais alto = mais vermelho) */}
				<Badge
					variant="muted"
					className={cn("shrink-0", isMaxAttention && "text-white")}
					style={{
						backgroundColor: isMaxAttention
							? "rgba(239, 68, 68, 0.35)"
							: `${task.priority.color}20`,
						color: isMaxAttention ? "#fff" : task.priority.color,
					}}
				>
					{task.priority.name}
				</Badge>
			</div>
		</div>
	);
}
