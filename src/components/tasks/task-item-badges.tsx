import {
	CheckCircle2,
	CircleDot,
	ClipboardCheck,
	ListChecks,
	Loader2,
	Terminal,
} from "lucide-react";

import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { DeleteConfirmButton } from "@/components/ui/delete-confirm-button";
import type { TaskAttentionState } from "@/domain/tasks/attention";
import type { TaskItemStatusPresentation } from "@/domain/tasks/task-item-visual-state";
import { isTauri } from "@/lib/tauri";
import { cn } from "@/lib/utils";

type ProgressInfo = {
	completed: number;
	total: number;
	variant: BadgeVariant | null;
};

type TaskItemBadgesProps = {
	isDefaultVariant: boolean;
	isMaxAttention: boolean;
	isTerminalOpen: boolean;
	isMutating: boolean;
	statusPresentation: TaskItemStatusPresentation;
	attention: TaskAttentionState;
	statusVariant: BadgeVariant;
	subtaskProgress: ProgressInfo;
	criteriaProgress: ProgressInfo;
	category: { name: string; color: string };
	priority: { name: string; color: string };
	onDelete: () => void;
};

export function TaskItemBadges({
	isDefaultVariant,
	isMaxAttention,
	isTerminalOpen,
	isMutating,
	statusPresentation,
	attention,
	statusVariant,
	subtaskProgress,
	criteriaProgress,
	category,
	priority,
	onDelete,
}: TaskItemBadgesProps) {
	const showSpinnerIndicator = statusPresentation.indicator === "spinner";
	const showCheckIndicator = statusPresentation.indicator === "check";
	const showDotIndicator = statusPresentation.indicator === "dot";

	return (
		<div className="flex shrink-0 justify-end items-center gap-2">
			{isTauri() && isTerminalOpen && (
				<span title="Terminal ativo">
					<Terminal size={14} className="text-green-500" />
				</span>
			)}

			{isDefaultVariant && showSpinnerIndicator && isMaxAttention && (
				<Loader2 size={14} className="animate-spin text-purple-300" />
			)}

			{isDefaultVariant && showSpinnerIndicator && !isMaxAttention && (
				<Loader2 size={14} className="animate-spin text-muted-foreground" />
			)}

			{isDefaultVariant && showCheckIndicator && (
				<CheckCircle2 size={14} style={{ color: statusPresentation.color }} />
			)}

			{isDefaultVariant && showDotIndicator && (
				<CircleDot size={14} style={{ color: statusPresentation.color }} />
			)}

			{!isDefaultVariant && isMaxAttention && (
				<Loader2 size={14} className="animate-spin text-purple-300" />
			)}

			{!isDefaultVariant && !isMaxAttention && attention.shouldSpin && (
				<Loader2 size={14} className="animate-spin text-muted-foreground" />
			)}

			{subtaskProgress.total > 0 && subtaskProgress.variant && (
				<Badge variant={subtaskProgress.variant} className="shrink-0 flex items-center gap-1">
					<ListChecks size={12} />
					{subtaskProgress.completed}/{subtaskProgress.total}
				</Badge>
			)}

			{isDefaultVariant && criteriaProgress.total > 0 && criteriaProgress.variant && (
				<Badge variant={criteriaProgress.variant} className="shrink-0 flex items-center gap-1">
					<ClipboardCheck size={12} />
					{criteriaProgress.completed}/{criteriaProgress.total}
				</Badge>
			)}

			{isDefaultVariant && (
				<Badge
					variant={statusPresentation.badgeVariant}
					className="shrink-0"
					style={{
						backgroundColor: `${statusPresentation.color}20`,
						color: statusPresentation.color,
					}}
				>
					{statusPresentation.label}
				</Badge>
			)}

			{!isDefaultVariant && (
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
			)}

			<Badge
				variant="muted"
				className="shrink-0"
				style={{
					backgroundColor: `${category.color}20`,
					color: category.color,
				}}
			>
				{category.name}
			</Badge>

			<Badge
				variant="muted"
				className={cn("shrink-0", isMaxAttention && "text-white")}
				style={{
					backgroundColor: isMaxAttention ? "rgba(239, 68, 68, 0.35)" : `${priority.color}20`,
					color: isMaxAttention ? "#fff" : priority.color,
				}}
			>
				{priority.name}
			</Badge>

			<DeleteConfirmButton
				onDelete={onDelete}
				disabled={isMutating}
				size="icon-sm"
				title="Remover tarefa"
				confirmTitle="Confirmar remoção da tarefa"
			/>
		</div>
	);
}
