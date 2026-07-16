import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Clock, FileStack, FileText, MoreVertical } from "lucide-react";
import { memo, useRef, useState } from "react";
import { toast } from "sonner";
import { tv, type VariantProps } from "tailwind-variants";

import { orpc } from "@/client";
import { Title } from "@/components/typography";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip } from "@/components/ui/tooltip";
import { COMPLEXITY_COLORS } from "@/constants/complexity";
import { recencyLevelClass } from "@/constants/tasks";
import { useClickOutside } from "@/hooks/use-click-outside";
import { useSetDoneMutation } from "@/hooks/use-set-done-mutation";
import { copyToClipboard } from "@/lib/build-prompt";
import { copyMarkdown, joinPath, openFolderInOs, shareFolderAsZip } from "@/lib/os-share";
import { relativeTimeFrom } from "@/lib/relative-time";
import { invalidateTaskQueries } from "@/lib/task-query-invalidation";
import { cn } from "@/lib/utils";
import type { TaskGroup, TaskWithMeta } from "@/types/tasks";
import { CompleteTaskFeatureDialog } from "./CompleteTaskFeatureDialog";
import {
	type TaskMenuActions,
	type TaskMenuData,
	type TaskMenuTarget,
	TaskContextMenu,
	taskMenuItems,
} from "./task-context-menu";
import { TaskMobileActionsDrawer } from "./task-mobile-actions-drawer";
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
	// listas genéricas não, mantendo a conclusão imediata.
	features?: TaskGroup[];
};

type TaskActionSurfaceProps = {
	task: TaskWithMeta;
	target: TaskMenuTarget;
	mode: "context" | "mobile";
	disabled: boolean;
	onClose?: () => void;
	onRename: () => void;
	onToggleDone: () => void;
};

function TaskActionSurface({
	task,
	target,
	mode,
	disabled,
	onClose,
	onRename,
	onToggleDone,
}: TaskActionSurfaceProps) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const projectsQuery = useQuery(orpc.projects.list.queryOptions());
	const prioritiesQuery = useQuery(orpc.priorities.list.queryOptions());
	const categoriesQuery = useQuery(orpc.categories.list.queryOptions());
	const projects = projectsQuery.data ?? [];

	const updateMutation = useMutation({
		...orpc.tasks.update.mutationOptions(),
		onSuccess: () => {
			void invalidateTaskQueries(queryClient, { taskId: task.id, projectId: task.projectId });
		},
	});
	const removeTaskMutation = useMutation({
		...orpc.tasks.remove.mutationOptions(),
		onSuccess: () => {
			void invalidateTaskQueries(queryClient, { taskId: task.id, projectId: task.projectId });
		},
	});
	const moveToProjectMutation = useMutation({
		...orpc.tasks.moveToProject.mutationOptions(),
		onSuccess: (_data, variables) => {
			void invalidateTaskQueries(queryClient, { taskId: task.id, projectId: task.projectId });
			void invalidateTaskQueries(queryClient, {
				taskId: task.id,
				projectId: variables.targetProjectId,
			});
		},
	});
	const ignoreRecencyMutation = useMutation({
		...orpc.tasks.ignoreRecency.mutationOptions(),
		onSuccess: () => {
			void invalidateTaskQueries(queryClient, { taskId: task.id, projectId: task.projectId });
			toast.success("Tarefa removida das recentes");
		},
		onError: () => toast.error("Não foi possível ignorar a tarefa"),
	});

	const data: TaskMenuData = {
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

	function taskDir() {
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

	async function copyTaskPath(value: TaskMenuTarget) {
		if (!value.folderPath) return;
		const path = value.folderPath.endsWith("/") ? value.folderPath : `${value.folderPath}/`;
		const ok = await copyToClipboard(path);
		toast[ok ? "success" : "error"](ok ? "Caminho da tarefa copiado" : "Falha ao copiar caminho");
	}

	const actions: TaskMenuActions = {
		onCopyPath: (value) => void copyTaskPath(value),
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
		onRename,
		onSetPriority: (_value, priorityId) => updateMutation.mutate({ id: task.id, priorityId }),
		onSetCategory: (_value, categoryId) => updateMutation.mutate({ id: task.id, categoryId }),
		onToggleDone,
		onIgnoreRecency: () => ignoreRecencyMutation.mutate({ id: task.id }),
		onMoveToProject: (_value, projectId) =>
			moveToProjectMutation.mutate({ id: task.id, targetProjectId: projectId }),
		onDelete: () => removeTaskMutation.mutate({ id: task.id }),
	};

	const isMutating =
		disabled ||
		updateMutation.isPending ||
		removeTaskMutation.isPending ||
		moveToProjectMutation.isPending ||
		ignoreRecencyMutation.isPending;

	if (mode === "context") return taskMenuItems(target, data, actions);

	return (
		<TaskMobileActionsDrawer
			open
			onClose={() => onClose?.()}
			target={target}
			data={data}
			actions={actions}
			complexity={task.complexity}
			onComplexityChange={(complexity) => updateMutation.mutate({ id: task.id, complexity })}
			disabled={isMutating}
		/>
	);
}

function TaskItemImpl({ task, variant = "default", highlight, features }: TaskItemProps) {
	const queryClient = useQueryClient();
	const isDone = task.done;
	const [editing, setEditing] = useState(false);
	const [linkingFeature, setLinkingFeature] = useState(false);
	const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
	const cardRef = useRef<HTMLDivElement>(null);

	useClickOutside(cardRef, () => setEditing(false), {
		enabled: editing,
		ignoreSelector: TASK_SELECT_CONTENT_SELECTOR,
	});

	const setDoneMutation = useSetDoneMutation(task.projectId);

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
		onSuccess: () => {
			void invalidateTaskQueries(queryClient, { taskId: task.id, projectId: task.projectId });
		},
	});

	const removeTaskMutation = useMutation({
		...orpc.tasks.remove.mutationOptions(),
		onSuccess: () => {
			void invalidateTaskQueries(queryClient, { taskId: task.id, projectId: task.projectId });
		},
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

	const artifactNames = task.artifactNames ?? [];
	const totalFileCount = task.fileNames.length + artifactNames.length;
	const hasArtifacts = artifactNames.length > 0;
	const menuTarget: TaskMenuTarget = {
		id: task.id,
		label: task.displayTitle,
		done: isDone,
		folderPath: task.folderPath,
		priorityId: task.priority?.id ?? null,
		categoryId: task.category?.id ?? null,
	};
	const fileBadgeLabel = hasArtifacts ? (
		<div className="flex flex-col gap-1">
			{task.fileNames.length > 0 ? (
				<div className="flex flex-col gap-0.5">
					<span className="font-medium text-muted-foreground">Arquivos</span>
					{task.fileNames.map((name) => (
						<span key={name}>- {name.replace(/\.md$/, "")}</span>
					))}
				</div>
			) : null}
			<div className="flex flex-col gap-0.5">
				<span className="font-medium text-muted-foreground">Artefatos</span>
				{artifactNames.map((name) => (
					<span key={name}>- {name}</span>
				))}
			</div>
		</div>
	) : (
		<div className="flex flex-col gap-0.5">
			<span className="font-medium text-muted-foreground">Arquivos</span>
			{task.fileNames.map((name) => (
				<span key={name}>- {name.replace(/\.md$/, "")}</span>
			))}
		</div>
	);

	return (
		<TaskContextMenu
			target={menuTarget}
			content={
				<TaskActionSurface
					task={task}
					target={menuTarget}
					mode="context"
					disabled={isMutating}
					onRename={() => setEditing(true)}
					onToggleDone={() => handleToggleDone(!isDone)}
				/>
			}
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
				// Sem prioridade, a borda cai pra cor da complexidade — sempre há uma.
				style={{ borderColor: `${task.priority?.color ?? COMPLEXITY_COLORS[task.complexity]}30` }}
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
					{totalFileCount > 0 && (
						<Tooltip label={fileBadgeLabel}>
							<span className="pointer-events-auto inline-flex items-center gap-1 rounded-md border border-border bg-secondary/40 px-1.5 py-0.5 text-muted-foreground text-xs">
								{hasArtifacts ? <FileStack className="size-3" /> : <FileText className="size-3" />}
								{totalFileCount}
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
					className="hidden md:flex"
					category={task.category}
					priority={task.priority}
					categoryId={task.category?.id ?? null}
					priorityId={task.priority?.id ?? null}
					complexity={task.complexity}
					editing={editing}
					disabled={isMutating}
					onToggleEdit={() => setEditing((value) => !value)}
					onCategoryChange={(categoryId) => updateMutation.mutate({ id: task.id, categoryId })}
					onPriorityChange={(priorityId) => updateMutation.mutate({ id: task.id, priorityId })}
					onComplexityChange={(complexity) => updateMutation.mutate({ id: task.id, complexity })}
					onDelete={() => removeTaskMutation.mutate({ id: task.id })}
				/>

				<button
					type="button"
					onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						setMobileActionsOpen(true);
					}}
					disabled={isMutating}
					aria-label="Ações da tarefa"
					className="pointer-events-auto relative z-10 flex shrink-0 items-center justify-center p-1 text-muted-foreground hover:text-foreground md:hidden"
				>
					<MoreVertical className="size-4" />
				</button>

				{mobileActionsOpen && (
					<TaskActionSurface
						task={task}
						target={menuTarget}
						mode="mobile"
						disabled={isMutating}
						onClose={() => setMobileActionsOpen(false)}
						onRename={() => setEditing(true)}
						onToggleDone={() => handleToggleDone(!isDone)}
					/>
				)}

				{linkingFeature && features && (
					<CompleteTaskFeatureDialog
						open
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

// Memoizado de propósito: a lista de tarefas monta dezenas destas linhas (cada uma com menu de
// contexto, drawer e selects) e os eventos de tasks re-renderizam a lista toda; com as referências
// de task/features estáveis (use-tasks-data memoiza), só as linhas que mudaram re-renderizam.
export const TaskItem = memo(TaskItemImpl);
