import { CalendarDays, Clock3 } from "lucide-react";

import { Text, Title } from "@/components/typography";
import type { TaskWithMeta } from "@/types/tasks";

export type AgendaTaskItemVariant = "agendaBacklog" | "agendaMini";

type TaskItemAgendaVariantProps = {
	task: TaskWithMeta;
	variant: AgendaTaskItemVariant;
	showScheduledDate?: boolean;
};

function formatScheduledLabel(task: TaskWithMeta) {
	if (!task.scheduledDate) return null;

	const date = new Date(`${task.scheduledDate}T00:00:00`);
	const dateLabel = date.toLocaleDateString("pt-BR", {
		day: "2-digit",
		month: "2-digit",
		weekday: "short",
	});

	const time = task.scheduledTime ?? "00:00";
	return `${dateLabel} ${time}`;
}

export function TaskItemAgendaVariant({
	task,
	variant,
	showScheduledDate = false,
}: TaskItemAgendaVariantProps) {
	if (variant === "agendaMini") {
		return (
			<div
				className="flex h-6 w-full max-w-[89px] items-center justify-center rounded border border-border/70 bg-background/90 px-1 text-[11px] font-semibold text-foreground"
				style={{ borderLeftWidth: "3px", borderLeftColor: task.category.color }}
			>
				{task.scheduledTime ?? "00:00"}
			</div>
		);
	}

	const scheduledLabel = formatScheduledLabel(task);

	return (
		<div className="w-full max-w-full rounded-md border border-border/70 bg-background px-3 py-2 transition-all hover:border-border hover:bg-secondary/30">
			<div className="flex items-start gap-2">
				<span
					className="mt-1 h-2 w-2 shrink-0 rounded-full"
					style={{ backgroundColor: task.category.color }}
				/>
				<div className="min-w-0 flex-1 space-y-1">
					<Title
						as="h3"
						size="sm"
						className="whitespace-pre-wrap break-words leading-5 font-medium"
					>
						{task.title}
					</Title>
					<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
						<div className="inline-flex items-center gap-1">
							<Clock3 className="h-3 w-3" />
							<Text as="span" size="xs" tone="muted">
								{task.priority.name}
							</Text>
						</div>
						{showScheduledDate && scheduledLabel && (
							<div className="inline-flex items-center gap-1">
								<CalendarDays className="h-3 w-3" />
								<Text as="span" size="xs" tone="muted">
									{scheduledLabel}
								</Text>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
