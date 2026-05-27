import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { tv, type VariantProps } from "tailwind-variants";

import { orpc } from "@/client";
import { Title } from "@/components/typography";
import { Checkbox } from "@/components/ui/checkbox";
import { CustomSelect } from "@/components/ui/custom-select";
import { DeleteConfirmButton } from "@/components/ui/delete-confirm-button";
import { cn } from "@/lib/utils";
import type { TaskWithMeta } from "@/types/tasks";
import { type AgendaTaskItemVariant, TaskItemAgendaVariant } from "./task-item-agenda-variant";

const taskItemVariants = tv({
	base: "flex items-center justify-between gap-4 border border-transparent bg-card transition-all duration-200 hover:border-border hover:bg-secondary/30 animate-fade-in w-full min-w-0 overflow-hidden",
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

export type TaskItemVariant =
	| VariantProps<typeof taskItemVariants>["variant"]
	| AgendaTaskItemVariant;

type TaskItemProps = {
	task: TaskWithMeta;
	variant?: TaskItemVariant;
	showScheduledDate?: boolean;
};

type ColoredItem = { id: string; name: string; color: string };

function MetaSelect({
	items,
	value,
	placeholder,
	onValueChange,
}: {
	items: ColoredItem[];
	value: string;
	placeholder: string;
	onValueChange: (value: string) => void;
}) {
	const selected = items.find((item) => item.id === value) ?? null;

	return (
		<div className="w-32 shrink-0">
			<CustomSelect
				items={items}
				value={value}
				onValueChange={onValueChange}
				variant="minimal"
				size="sm"
				triggerClassName="gap-1 border border-border bg-muted/40 px-2 text-muted-foreground hover:border-muted-foreground hover:bg-muted hover:text-foreground"
				renderTrigger={() => (
					<>
						<span className="flex min-w-0 items-center gap-1.5">
							<span
								className="size-2 shrink-0 rounded-full"
								style={{ backgroundColor: selected?.color ?? "#6b7280" }}
							/>
							<span className="truncate text-xs">{selected?.name ?? placeholder}</span>
						</span>
						<ChevronDown className="size-3.5 shrink-0 opacity-50" />
					</>
				)}
				renderItem={(item, isSelected) => (
					<div className={cn("flex w-full items-center gap-2", isSelected && "font-medium")}>
						<span
							className="size-2 shrink-0 rounded-full"
							style={{ backgroundColor: item.color }}
						/>
						<span className="truncate">{item.name}</span>
					</div>
				)}
			/>
		</div>
	);
}

function TaskItemDefault({
	task,
	variant,
}: {
	task: TaskWithMeta;
	variant: "default" | "compact";
}) {
	const queryClient = useQueryClient();
	const isDone = task.done;

	const categoriesQuery = useQuery(orpc.categories.list.queryOptions());
	const prioritiesQuery = useQuery(orpc.priorities.list.queryOptions());

	function invalidateTasks() {
		queryClient.invalidateQueries({
			predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "tasks",
		});
	}

	const setDoneMutation = useMutation({
		...orpc.tasks.setDone.mutationOptions(),
		onSuccess: invalidateTasks,
	});

	const updateMutation = useMutation({
		...orpc.tasks.update.mutationOptions(),
		onSuccess: invalidateTasks,
	});

	const removeTaskMutation = useMutation({
		...orpc.tasks.remove.mutationOptions(),
		onSuccess: invalidateTasks,
	});

	const isMutating = setDoneMutation.isPending || removeTaskMutation.isPending;

	return (
		<div
			className={cn(taskItemVariants({ variant }), "border", isDone && "opacity-60")}
			style={{ borderColor: `${task.priority.color}30` }}
		>
			<div className="flex min-w-0 flex-1 items-center gap-3">
				<Checkbox
					checked={isDone}
					onCheckedChange={(checked) =>
						setDoneMutation.mutate({ id: task.id, done: checked === true })
					}
					disabled={isMutating}
					aria-label={isDone ? "Marcar como não concluída" : "Marcar como concluída"}
				/>
				<Link to="/tarefas/$taskId" params={{ taskId: task.id }} className="min-w-0 flex-1">
					<Title
						as="span"
						size="sm"
						className={cn(
							"block truncate text-base font-normal tracking-wide",
							isDone && "text-muted-foreground line-through",
						)}
					>
						{task.title}
					</Title>
				</Link>
			</div>

			<div className="flex shrink-0 items-center gap-2">
				<MetaSelect
					items={categoriesQuery.data ?? []}
					value={task.category.id}
					placeholder="Categoria"
					onValueChange={(categoryId) => updateMutation.mutate({ id: task.id, categoryId })}
				/>
				<MetaSelect
					items={prioritiesQuery.data ?? []}
					value={task.priority.id}
					placeholder="Prioridade"
					onValueChange={(priorityId) => updateMutation.mutate({ id: task.id, priorityId })}
				/>
				<DeleteConfirmButton
					onDelete={() => removeTaskMutation.mutate({ id: task.id })}
					disabled={isMutating}
					sizeVariant="xs"
					title="Excluir tarefa"
					confirmTitle="Clique de novo para excluir"
				/>
			</div>
		</div>
	);
}

export function TaskItem({ task, variant = "default", showScheduledDate = false }: TaskItemProps) {
	if (variant === "agendaBacklog" || variant === "agendaMini") {
		return (
			<TaskItemAgendaVariant task={task} variant={variant} showScheduledDate={showScheduledDate} />
		);
	}

	return <TaskItemDefault task={task} variant={variant} />;
}
