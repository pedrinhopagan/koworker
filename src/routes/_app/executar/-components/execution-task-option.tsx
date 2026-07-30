import { CheckCircle2 } from "lucide-react";

import type { RouterOutputs } from "@/client";
import { taskItemVariants } from "@/components/tasks";
import { TaskMetaIndicators } from "@/components/tasks/task-meta-controls";
import { Text, Title } from "@/components/typography";
import { Checkbox } from "@/components/ui/checkbox";
import { COMPLEXITY_COLORS } from "@/constants/complexity";
import { useRovingOption } from "@/hooks/use-roving-listbox";
import { cn } from "@/lib/utils";

type Task = RouterOutputs["tasks"]["listByProject"][number];
type Category = { id: string; name: string; color: string };
type Priority = { id: string; name: string; color: string };

export function ExecutionTaskOption({
	task,
	category,
	priority,
	selected,
	active,
	focused,
	onSelect,
	onActivate,
}: {
	task: Task;
	category?: Category;
	priority?: Priority;
	selected: boolean;
	active: boolean;
	focused: boolean;
	onSelect: () => void;
	onActivate: () => void;
}) {
	const accent = priority?.color ?? COMPLEXITY_COLORS[task.complexity];
	const ref = useRovingOption<HTMLDivElement>(focused);

	return (
		<div
			ref={ref}
			role="option"
			aria-selected={selected}
			tabIndex={active ? 0 : -1}
			onClick={onSelect}
			onFocus={onActivate}
			onMouseEnter={onActivate}
			className={cn(
				taskItemVariants({ variant: "default" }),
				"group cursor-pointer border text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
			)}
			style={{ borderColor: `${accent}30` }}
		>
			<Checkbox
				checked={selected}
				onClick={(event) => event.stopPropagation()}
				onCheckedChange={onSelect}
				tabIndex={-1}
				aria-label={`Selecionar ${task.displayTitle}`}
				className="size-5 md:size-4"
			/>
			<span className="min-w-0 flex-1">
				<span className="flex min-w-0 items-center gap-2">
					<Title
						as="span"
						size="sm"
						className={cn(
							"block truncate text-base font-normal tracking-wide",
							task.done && "text-muted-foreground line-through",
						)}
					>
						{task.displayTitle}
					</Title>
					{task.done && <CheckCircle2 className="size-3.5 shrink-0 text-primary" />}
				</span>
				<Text size="xs" tone="muted" className="truncate font-mono">
					{task.folderPath}
				</Text>
			</span>
			<TaskMetaIndicators
				category={category ?? null}
				priority={priority ?? null}
				complexity={task.complexity}
				className="gap-2"
			/>
		</div>
	);
}
