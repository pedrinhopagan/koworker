import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Clock, FileText } from "lucide-react";
import { useRef, useState } from "react";
import { tv, type VariantProps } from "tailwind-variants";

import { orpc } from "@/client";
import { Title } from "@/components/typography";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip } from "@/components/ui/tooltip";
import { recencyLevelClass } from "@/constants/tasks";
import { useClickOutside } from "@/hooks/use-click-outside";
import { relativeTimeFrom } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import type { TaskWithMeta } from "@/types/tasks";
import {
	TASK_SELECT_CONTENT_SELECTOR,
	TaskMetaControls,
	TaskTitleInput,
	taskTitlePlaceholder,
} from "./task-meta-controls";

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

export type TaskItemVariant = VariantProps<typeof taskItemVariants>["variant"];

type TaskItemProps = {
	task: TaskWithMeta;
	variant?: TaskItemVariant;
	// Destaque de recência: 1 = última editada (mais forte), 2/3 = anteriores (mais sutil).
	highlight?: number;
};

function TaskItemDefault({
	task,
	variant,
	highlight,
}: {
	task: TaskWithMeta;
	variant: "default" | "compact";
	highlight?: number;
}) {
	const queryClient = useQueryClient();
	const isDone = task.done;
	// Modo de edição (toggle pelo lápis): libera o input de título e torna os selects
	// clicáveis. Fora dele o item inteiro é um link para a rota da tarefa.
	const [editing, setEditing] = useState(false);
	const cardRef = useRef<HTMLDivElement>(null);

	// Clicar fora conclui a edição: o blur do input já salvou o título; o dropdown do
	// select vive em portal, então cliques nele não contam como "fora".
	useClickOutside(cardRef, () => setEditing(false), {
		enabled: editing,
		ignoreSelector: TASK_SELECT_CONTENT_SELECTOR,
	});

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

	const isMutating =
		setDoneMutation.isPending || removeTaskMutation.isPending || updateMutation.isPending;

	// Salva sem sair do modo: quem controla o modo é o lápis. Assim dá pra renomear e
	// mexer nos selects na mesma sessão sem o blur do input fechar a edição.
	function saveTitle(value: string) {
		const next = value.trim();
		if (next === (task.title ?? "")) return;
		updateMutation.mutate({ id: task.id, title: next });
	}

	return (
		<div
			ref={cardRef}
			className={cn(
				taskItemVariants({ variant }),
				"relative border",
				!editing && "cursor-pointer",
				isDone && "opacity-60",
				!isDone && highlight === 1 && "bg-primary/[0.04]",
			)}
			style={{ borderColor: `${task.priority.color}30` }}
		>
			{!isDone && highlight ? (
				<span
					aria-hidden
					className={cn(
						"pointer-events-none absolute inset-y-0 left-0 z-10 w-1 rounded-r-sm",
						recencyLevelClass(highlight),
					)}
				/>
			) : null}

			{!editing && (
				<Link
					to="/tarefas/$taskId"
					params={{ taskId: task.id }}
					className="absolute inset-0 z-0"
					aria-label={task.displayTitle}
				/>
			)}

			<div className="pointer-events-none relative z-10 flex min-w-0 flex-1 items-center gap-3">
				<Checkbox
					className="pointer-events-auto"
					checked={isDone}
					onCheckedChange={(checked) =>
						setDoneMutation.mutate({ id: task.id, done: checked === true })
					}
					disabled={isMutating}
					aria-label={isDone ? "Marcar como não concluída" : "Marcar como concluída"}
				/>
				{task.fileNames.length > 0 && (
					<Tooltip
						label={
							<div className="flex flex-col gap-0.5">
								<span className="font-medium text-muted-foreground">Arquivos</span>
								{task.fileNames.map((name) => (
									<span key={name}>- {name.replace(/\.md$/, "")}</span>
								))}
							</div>
						}
					>
						<span className="pointer-events-auto inline-flex items-center gap-1 rounded-md border border-border bg-secondary/40 px-1.5 py-0.5 text-muted-foreground text-xs">
							<FileText className="size-3" />
							{task.fileNames.length}
						</span>
					</Tooltip>
				)}
				{editing ? (
					<div className="pointer-events-auto min-w-0 flex-1">
						<TaskTitleInput
							initialValue={task.title ?? ""}
							placeholder={taskTitlePlaceholder(task)}
							onSave={saveTitle}
							onCancel={() => setEditing(false)}
						/>
					</div>
				) : (
					<Title
						as="span"
						size="sm"
						className={cn(
							"block truncate text-base font-normal tracking-wide",
							isDone && "text-muted-foreground line-through",
						)}
					>
						{task.displayTitle}
					</Title>
				)}
			</div>

			{!isDone && highlight ? (
				<span
					className={cn(
						"pointer-events-none relative z-10 hidden shrink-0 items-center gap-1 text-xs tabular-nums sm:flex",
						highlight === 1 ? "text-primary" : "text-muted-foreground",
					)}
					title="Último arquivo editado"
				>
					<Clock className="size-3" />
					{relativeTimeFrom(task.lastEditedAt)}
				</span>
			) : null}

			<TaskMetaControls
				categoryId={task.category.id}
				priorityId={task.priority.id}
				editing={editing}
				disabled={isMutating}
				onToggleEdit={() => setEditing((value) => !value)}
				onCategoryChange={(categoryId) => updateMutation.mutate({ id: task.id, categoryId })}
				onPriorityChange={(priorityId) => updateMutation.mutate({ id: task.id, priorityId })}
				onDelete={() => removeTaskMutation.mutate({ id: task.id })}
			/>
		</div>
	);
}

export function TaskItem({ task, variant = "default", highlight }: TaskItemProps) {
	return <TaskItemDefault task={task} variant={variant} highlight={highlight} />;
}
