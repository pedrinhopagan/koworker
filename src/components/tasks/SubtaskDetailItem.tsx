import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { tv } from "tailwind-variants";

import { orpc } from "@/client";
import { CompletionToggle } from "@/components/tasks/CompletionToggle";
import { Text, Title } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { getStatusLabel, getStatusVariant } from "@/domain/tasks/status";
import { cn } from "@/lib/utils";
import type { SubtaskFull } from "@/types/tasks";

const subtaskDetailVariants = tv({
	slots: {
		root: "flex flex-col gap-2",
		header:
			"flex items-center justify-between gap-4 border border-transparent bg-card transition-all duration-200 hover:border-border hover:bg-secondary/30 w-full",
		titleRow: "flex min-w-0 items-center gap-3 flex-1",
		checkbox: "text-muted-foreground transition-colors shrink-0",
		title: "truncate text-sm font-normal",
		metaRow: "flex items-center gap-2 shrink-0",
		chevron: "flex h-6 w-6 items-center justify-center text-muted-foreground transition-transform",
		details: "pl-6 pr-2 pb-2 space-y-3",
		detailGrid: "grid gap-2 sm:grid-cols-2",
	},
	variants: {
		done: {
			true: {
				header: "opacity-70",
				checkbox: "text-primary",
				title: "line-through text-muted-foreground",
			},
		},
		open: {
			true: {
				chevron: "rotate-180",
			},
		},
	},
	defaultVariants: {
		done: false,
		open: false,
	},
});

type SubtaskDetailItemProps = {
	subtask: SubtaskFull;
};

export function SubtaskDetailItem({ subtask }: SubtaskDetailItemProps) {
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const isDone = subtask.status === "executed";

	const updateMutation = useMutation({
		...orpc.subtasks.update.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "tasks",
			});
			queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "subtasks",
			});
		},
	});

	function handleToggleOpen() {
		setOpen((prev) => !prev);
	}

	function formatTimestamp(value?: number | null) {
		return value ? new Date(value).toLocaleString() : "—";
	}

	const styles = subtaskDetailVariants({ done: isDone, open });
	const statusLabel = getStatusLabel(subtask.status);
	const statusVariant = getStatusVariant(subtask.status);

	return (
		<div className={styles.root()}>
			<div
				className={styles.header()}
				role="button"
				tabIndex={0}
				aria-expanded={open}
				onClick={handleToggleOpen}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						handleToggleOpen();
					}
				}}
			>
				<div className={styles.titleRow()}>
					<CompletionToggle
						checked={isDone}
						onCheckedChange={() => {
							const newStatus = isDone ? "pending" : "executed";
							const completedAt = newStatus === "executed" ? Date.now() : null;
							updateMutation.mutate({ id: subtask.id, status: newStatus, completedAt });
						}}
						disabled={updateMutation.isPending}
						aria-label={isDone ? "Marcar como pendente" : "Marcar como concluída"}
					/>
					<Title as="span" size="sm" className={styles.title()}>
						{subtask.title}
					</Title>
				</div>
				<div className={styles.metaRow()}>
					<Badge variant={statusVariant}>{statusLabel}</Badge>
					<ChevronDown className={styles.chevron()} />
				</div>
			</div>

			{open && (
				<div className={styles.details()}>
					<div className="space-y-1">
						<Text size="xs" tone="muted">
							Descrição
						</Text>
						<Text size="sm" className={cn(!subtask.description && "text-muted-foreground")}>
							{subtask.description || "Sem descrição"}
						</Text>
					</div>
					<div className={styles.detailGrid()}>
						<div className="space-y-1">
							<Text size="xs" tone="muted">
								Status
							</Text>
							<Text size="sm">{statusLabel}</Text>
						</div>
						<div className="space-y-1">
							<Text size="xs" tone="muted">
								Criada em
							</Text>
							<Text size="sm">{formatTimestamp(subtask.createdAt)}</Text>
						</div>
						<div className="space-y-1">
							<Text size="xs" tone="muted">
								Atualizada em
							</Text>
							<Text size="sm">{formatTimestamp(subtask.updatedAt)}</Text>
						</div>
						<div className="space-y-1">
							<Text size="xs" tone="muted">
								Concluída em
							</Text>
							<Text size="sm">{formatTimestamp(subtask.completedAt)}</Text>
						</div>
						<div className="space-y-1">
							<Text size="xs" tone="muted">
								ID
							</Text>
							<Text size="sm" className="truncate">
								{subtask.id}
							</Text>
						</div>
						<div className="space-y-1">
							<Text size="xs" tone="muted">
								Task ID
							</Text>
							<Text size="sm" className="truncate">
								{subtask.taskId}
							</Text>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
