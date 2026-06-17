import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Clock, FileText } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { tv, type VariantProps } from "tailwind-variants";

import { orpc } from "@/client";
import { Title } from "@/components/typography";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip } from "@/components/ui/tooltip";
import { recencyLevelClass } from "@/constants/tasks";
import { useClickOutside } from "@/hooks/use-click-outside";
import { useSetDoneMutation } from "@/hooks/use-set-done-mutation";
import { copyMarkdown, joinPath, openFolderInOs, shareFolderAsZip } from "@/lib/os-share";
import { relativeTimeFrom } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import type { TaskGroup, TaskWithMeta } from "@/types/tasks";
import { CompleteTaskFeatureDialog } from "./CompleteTaskFeatureDialog";
import { type TaskMenuActions, type TaskMenuData, TaskContextMenu } from "./task-context-menu";
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
	// Features do projeto. Quando presentes, concluir uma tarefa "Sem feature" abre o dialog de
	// vínculo em vez de concluir direto — o incentivo a classificar. A lista de Tarefas passa isto;
	// agenda e listas genéricas não, mantendo a conclusão imediata.
	features?: TaskGroup[];
};

function TaskItemDefault({
	task,
	variant,
	highlight,
	features,
}: {
	task: TaskWithMeta;
	variant: "default" | "compact";
	highlight?: number;
	features?: TaskGroup[];
}) {
	const queryClient = useQueryClient();
	const isDone = task.done;
	// Modo de edição (toggle pelo lápis): libera o input de título e torna os selects
	// clicáveis. Fora dele o item inteiro é um link para a rota da tarefa.
	const [editing, setEditing] = useState(false);
	const [linkingFeature, setLinkingFeature] = useState(false);
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

	const setDoneMutation = useSetDoneMutation();

	// Tarefa sem feature, com features disponíveis: concluir abre o dialog de vínculo. Os demais
	// casos (reabrir, já tem feature, projeto sem features) concluem direto.
	function handleToggleDone(next: boolean) {
		if (next && !task.groupId && features && features.length > 0) {
			setLinkingFeature(true);
			return;
		}
		setDoneMutation.mutate({ id: task.id, done: next });
	}

	function completeWithFeature(groupId: string | undefined) {
		setDoneMutation.mutate(
			{ id: task.id, done: true, groupId },
			{ onSuccess: () => setLinkingFeature(false) },
		);
	}

	const updateMutation = useMutation({
		...orpc.tasks.update.mutationOptions(),
		onSuccess: invalidateTasks,
	});

	const removeTaskMutation = useMutation({
		...orpc.tasks.remove.mutationOptions(),
		onSuccess: invalidateTasks,
	});

	const moveToProjectMutation = useMutation({
		...orpc.tasks.moveToProject.mutationOptions(),
		onSuccess: invalidateTasks,
	});

	const navigate = useNavigate();

	// Dados dos submenus do menu de contexto. As três listas já vêm do cache do react-query (a
	// página de tarefas as carrega), então reler aqui não dispara fetch novo.
	const projectsQuery = useQuery(orpc.projects.list.queryOptions());
	const prioritiesQuery = useQuery(orpc.priorities.list.queryOptions());
	const categoriesQuery = useQuery(orpc.categories.list.queryOptions());
	const projects = projectsQuery.data ?? [];

	const taskMenuData: TaskMenuData = {
		projects: projects
			.filter((project) => project.id !== task.projectId)
			.map((project) => ({ id: project.id, name: project.name, color: project.color })),
		priorities: (prioritiesQuery.data ?? []).map((priority) => ({
			id: priority.id,
			name: priority.name,
			color: priority.color,
		})),
		categories: (categoriesQuery.data ?? []).map((category) => ({
			id: category.id,
			name: category.name,
			color: category.color,
		})),
	};

	// Dir absoluto da pasta da tarefa pros comandos do SO (abrir/zip). Resolve o mainRoute do projeto
	// da tarefa + o folder_path do backend. Sem um dos dois, as ações viram no-op.
	function taskDir(): string | null {
		const route = projects.find((project) => project.id === task.projectId)?.mainRoute;
		if (!route || !task.folderPath) return null;
		return joinPath(route, task.folderPath);
	}

	async function shareContent() {
		try {
			const result = await queryClient.fetchQuery({
				...orpc.vault.exportContent.queryOptions({
					input: { projectId: task.projectId, target: { kind: "task", taskId: task.id } },
				}),
				staleTime: 0,
			});
			await copyMarkdown(result.content);
		} catch {
			toast.error("Não foi possível exportar o conteúdo");
		}
	}

	const menuActions: TaskMenuActions = {
		onOpen: () => navigate({ to: "/tarefas/$taskId", params: { taskId: task.id } }),
		onShareContent: () => void shareContent(),
		onShareZip: () => {
			const dir = taskDir();
			if (dir) void shareFolderAsZip(dir);
		},
		onOpenInOs: () => {
			const dir = taskDir();
			if (dir) void openFolderInOs(dir);
		},
		onRename: () => setEditing(true),
		onSetPriority: (_t, priorityId) => updateMutation.mutate({ id: task.id, priorityId }),
		onSetCategory: (_t, categoryId) => updateMutation.mutate({ id: task.id, categoryId }),
		onToggleDone: () => handleToggleDone(!isDone),
		onMoveToProject: (_t, projectId) =>
			moveToProjectMutation.mutate({ id: task.id, targetProjectId: projectId }),
		onDelete: () => removeTaskMutation.mutate({ id: task.id }),
	};

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
		<TaskContextMenu
			target={{
				id: task.id,
				label: task.displayTitle,
				done: isDone,
				priorityId: task.priority.id,
				categoryId: task.category.id,
			}}
			data={taskMenuData}
			actions={menuActions}
		>
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
						onCheckedChange={(checked) => handleToggleDone(checked === true)}
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

				{features && (
					<CompleteTaskFeatureDialog
						open={linkingFeature}
						onClose={() => setLinkingFeature(false)}
						taskTitle={task.displayTitle}
						features={features}
						loading={setDoneMutation.isPending}
						onComplete={completeWithFeature}
					/>
				)}
			</div>
		</TaskContextMenu>
	);
}

export function TaskItem({ task, variant = "default", highlight, features }: TaskItemProps) {
	return (
		<TaskItemDefault task={task} variant={variant} highlight={highlight} features={features} />
	);
}
