import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	File,
	FileCode2,
	FileText,
	ListChecks,
	type LucideIcon,
	Loader2,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { DocShareControls } from "@/components/doc-share-controls";
import { FileContextMenu } from "@/components/file-context-menu";
import {
	TASK_SELECT_CONTENT_SELECTOR,
	TaskEditControls,
	TaskMetaSelects,
	TaskTitleInput,
	taskTitlePlaceholder,
} from "@/components/tasks/task-meta-controls";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { useClickOutside } from "@/hooks/use-click-outside";
import { useSetDoneMutation } from "@/hooks/use-set-done-mutation";
import { copyToClipboard } from "@/lib/build-prompt";
import { relativeTimeFrom } from "@/lib/relative-time";
import { invalidateTaskQueries } from "@/lib/task-query-invalidation";
import { cn } from "@/lib/utils";
import { FlowRunButton } from "./-components/flow-run-button";
import {
	markdownHeadings,
	markdownSummary,
	markdownTitle,
	TaskFileCard,
} from "./-components/task-file-card";
import { TaskOverviewContextMenu } from "./-components/task-overview-context-menu";
import { TaskMergeAction } from "./-components/task-merge-action";
import { useTaskShare } from "./-components/use-task-share";

export const Route = createFileRoute("/_app/tarefas/$taskId/")({
	component: TaskOverviewPage,
});

function artifactIcon(mime: string): LucideIcon {
	if (mime === "application/pdf") {
		return FileText;
	}
	if (mime === "text/html") {
		return FileCode2;
	}
	return File;
}

// Divisor de seção: rótulo em caixa alta seguido de uma linha fina até a borda. Separa o card do
// index da grade de arquivos e nomeia a seção de artefatos.
function SectionDivider({ label }: { label: string }) {
	return (
		<div className="flex items-center gap-3">
			<span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
			<span className="h-px flex-1 bg-border" />
		</div>
	);
}

function TaskOverviewPage() {
	const { taskId } = Route.useParams();
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const taskQuery = useQuery(orpc.tasks.getFull.queryOptions({ input: { id: taskId } }));
	const task = taskQuery.data ?? null;

	const [editing, setEditing] = useState(false);
	const [newFileValue, setNewFileValue] = useState("");
	const [renamingFile, setRenamingFile] = useState<string | null>(null);
	const [renameValue, setRenameValue] = useState("");
	const [deletingFile, setDeletingFile] = useState<string | null>(null);
	const headerRef = useRef<HTMLDivElement>(null);

	useClickOutside(headerRef, () => setEditing(false), {
		enabled: editing,
		ignoreSelector: TASK_SELECT_CONTENT_SELECTOR,
	});

	function invalidateTasks() {
		void invalidateTaskQueries(queryClient, {
			taskId,
			projectId: task?.projectId,
		});
	}

	const setDoneMutation = useSetDoneMutation(task?.projectId);

	const updateMutation = useMutation({
		...orpc.tasks.update.mutationOptions(),
		onSuccess: invalidateTasks,
	});

	const removeTaskMutation = useMutation({
		...orpc.tasks.remove.mutationOptions(),
		onSuccess: () => {
			invalidateTasks();
			navigate({ to: "/tarefas" });
		},
	});

	const writeFileMutation = useMutation({
		...orpc.tasks.writeFile.mutationOptions(),
		onSuccess: async (_result, variables) => {
			await queryClient.invalidateQueries(
				orpc.tasks.getFull.queryOptions({ input: { id: taskId } }),
			);
			navigate({
				to: "/tarefas/$taskId/$file",
				params: { taskId, file: variables.name },
				replace: true,
			});
		},
	});

	const openArtifactMutation = useMutation({
		...orpc.tasks.openArtifact.mutationOptions(),
		onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao abrir"),
	});

	const invalidateFull = () =>
		queryClient.invalidateQueries(orpc.tasks.getFull.queryOptions({ input: { id: taskId } }));

	const renameFileMutation = useMutation({
		...orpc.tasks.renameFile.mutationOptions(),
		onSuccess: invalidateFull,
		onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao renomear"),
	});

	const deleteFileMutation = useMutation({
		...orpc.tasks.deleteFile.mutationOptions(),
		onSuccess: () => {
			void invalidateFull();
			setDeletingFile(null);
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao deletar"),
	});

	const share = useTaskShare(task);

	if (taskQuery.isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="flex items-center gap-2 text-muted-foreground">
					<Loader2 size={18} className="animate-spin" />
					<Text size="sm" tone="muted">
						Carregando tarefa...
					</Text>
				</div>
			</div>
		);
	}

	if (!task) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4">
				<Text size="sm" tone="muted">
					Tarefa não encontrada.
				</Text>
				<Button variant="outline" asChild>
					<Link to="/tarefas">Voltar para tarefas</Link>
				</Button>
			</div>
		);
	}

	const isMutating =
		setDoneMutation.isPending || updateMutation.isPending || removeTaskMutation.isPending;

	const saveTitle = (value: string) => {
		const next = value.trim();
		if (next === (task.title ?? "")) {
			return;
		}
		updateMutation.mutate({ id: task.id, title: next });
	};

	const createFile = () => {
		const raw = newFileValue.trim();
		if (!raw) {
			return;
		}
		const name = raw.endsWith(".md") ? raw : `${raw}.md`;
		writeFileMutation.mutate({ id: taskId, name, content: "" });
	};

	const startRename = (name: string) => {
		setRenamingFile(name);
		setRenameValue(name);
	};

	const copyTaskPath = async () => {
		const path = task.folderPath.endsWith("/") ? task.folderPath : `${task.folderPath}/`;
		const ok = await copyToClipboard(path);
		toast[ok ? "success" : "error"](ok ? "Caminho da tarefa copiado" : "Falha ao copiar caminho");
	};

	const confirmRename = () => {
		const newName = renameValue.trim();
		if (!newName || !renamingFile || newName === renamingFile) {
			setRenamingFile(null);
			return;
		}
		const ext = renamingFile.slice(renamingFile.lastIndexOf("."));
		if (!newName.endsWith(ext)) {
			toast.error(`O nome deve terminar em ${ext}`);
			return;
		}
		renameFileMutation.mutate({ id: taskId, oldName: renamingFile, newName });
		setRenamingFile(null);
	};

	const indexFile = task.files[0]?.name === "index.md" ? task.files[0] : null;
	const gridFiles = indexFile ? task.files.slice(1) : task.files;

	const lastEditMs = Math.max(
		0,
		...task.files.map((file) => file.editedAt),
		...task.attachments.map((attachment) => attachment.mtime),
	);
	const headerDescription = [
		`${task.files.length} ${task.files.length === 1 ? "arquivo" : "arquivos"}`,
		task.attachments.length > 0
			? `${task.attachments.length} ${task.attachments.length === 1 ? "artefato" : "artefatos"}`
			: null,
		lastEditMs > 0 ? `editada ${relativeTimeFrom(lastEditMs)}` : null,
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<TaskOverviewContextMenu
			label={task.displayTitle}
			actions={{
				onCopyPath: () => void copyTaskPath(),
				onOpenInOs: share.openInOs,
				onCopyContent: () => void share.copyContent(),
				onCopyZip: () => void share.copyZip(),
			}}
		>
			<div className="relative flex h-full w-full flex-col">
				<div className="w-full border-b border-border">
					<div
						ref={headerRef}
						className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3"
					>
						<div className="flex min-w-0 flex-1 items-center gap-3">
							<Link
								to="/tarefas"
								className="flex size-8 shrink-0 items-center justify-center border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
								aria-label="Voltar para tarefas"
							>
								<ArrowLeft className="size-4" />
							</Link>
							<Icon icon={ListChecks} color="var(--project-accent, var(--primary))" size="md" />
							<div className="min-w-0 flex-1">
								{editing ? (
									<TaskTitleInput
										initialValue={task.title ?? ""}
										placeholder={taskTitlePlaceholder(task)}
										onSave={saveTitle}
										onCancel={() => setEditing(false)}
									/>
								) : (
									<Title
										size="lg"
										className={cn(
											"truncate uppercase tracking-[0.12em]",
											task.done && "text-muted-foreground line-through",
										)}
									>
										{task.displayTitle}
									</Title>
								)}
								<Text size="xs" tone="muted" className="truncate">
									{headerDescription}
								</Text>
							</div>
						</div>
						<div className="flex shrink-0 items-center gap-2">
							<Checkbox
								checked={task.done}
								onCheckedChange={(checked) =>
									setDoneMutation.mutate({ id: task.id, done: checked === true })
								}
								disabled={isMutating}
								aria-label={task.done ? "Marcar como não concluída" : "Marcar como concluída"}
							/>
							<TaskMetaSelects
								categoryId={task.categoryId ?? null}
								priorityId={task.priorityId ?? null}
								complexity={task.complexity}
								interactive={editing}
								onCategoryChange={(categoryId) =>
									updateMutation.mutate({ id: task.id, categoryId })
								}
								onPriorityChange={(priorityId) =>
									updateMutation.mutate({ id: task.id, priorityId })
								}
								onComplexityChange={(complexity) =>
									updateMutation.mutate({ id: task.id, complexity })
								}
							/>
							<TaskEditControls
								editing={editing}
								disabled={isMutating}
								onToggleEdit={() => setEditing((value) => !value)}
								onDelete={() => removeTaskMutation.mutate({ id: task.id })}
							/>
							<FlowRunButton taskId={taskId} />
							{share.folderAbs ? (
								<DocShareControls
									onOpenInOs={share.openInOs}
									onCopyContent={() => void share.copyContent()}
									onCopyZip={() => void share.copyZip()}
								/>
							) : null}
						</div>
					</div>
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto pb-24">
					<div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
						{task.files.length > 0 ? (
							<div className="flex flex-col gap-3">
								{indexFile ? (
									<FileContextMenu
										name={indexFile.name}
										route={`/tarefas/${taskId}/${indexFile.name}`}
										path={`${task.folderPath}/${indexFile.name}`}
										onOpenFolder={share.openInOs}
										onRename={() => startRename(indexFile.name)}
										onDelete={() => setDeletingFile(indexFile.name)}
									>
										<TaskFileCard
											hero
											icon={FileText}
											name={indexFile.name}
											title={markdownTitle(indexFile.content) ?? "Arquivo sem header"}
											summary={markdownSummary(indexFile.content)}
											headings={markdownHeadings(indexFile.content)}
											size={indexFile.size}
											timestamp={indexFile.editedAt}
											to="/tarefas/$taskId/$file"
											params={{ taskId, file: indexFile.name }}
										/>
									</FileContextMenu>
								) : null}
								{gridFiles.length > 0 ? (
									<div className="flex flex-col gap-3">
										{indexFile ? <SectionDivider label="Arquivos" /> : null}
										<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
											{gridFiles.map((file) => (
												<FileContextMenu
													key={file.name}
													name={file.name}
													route={`/tarefas/${taskId}/${file.name}`}
													path={`${task.folderPath}/${file.name}`}
													onOpenFolder={share.openInOs}
													onRename={() => startRename(file.name)}
													onDelete={() => setDeletingFile(file.name)}
												>
													<TaskFileCard
														icon={FileText}
														name={file.name}
														title={markdownTitle(file.content) ?? "Arquivo sem header"}
														summary={markdownSummary(file.content)}
														size={file.size}
														timestamp={file.editedAt}
														to="/tarefas/$taskId/$file"
														params={{ taskId, file: file.name }}
													/>
												</FileContextMenu>
											))}
										</div>
									</div>
								) : null}
							</div>
						) : (
							<div className="flex flex-col items-center gap-4 py-10">
								<Text size="sm" tone="muted">
									Nenhum arquivo markdown nesta tarefa.
								</Text>
								<div className="flex w-full max-w-xs items-center gap-2">
									<input
										// biome-ignore lint/a11y/noAutofocus: única ação óbvia numa tarefa sem arquivos.
										autoFocus
										value={newFileValue}
										onChange={(e) => setNewFileValue(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												createFile();
											}
										}}
										placeholder="index.md"
										className="h-9 min-w-0 flex-1 rounded-md border border-border bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
									/>
									<Button size="sm" onClick={createFile} disabled={writeFileMutation.isPending}>
										{writeFileMutation.isPending ? (
											<Loader2 size={14} className="animate-spin" />
										) : (
											"Criar"
										)}
									</Button>
								</div>
							</div>
						)}

						{task.attachments.length > 0 ? (
							<div className="flex flex-col gap-3">
								<SectionDivider label="Artefatos" />
								<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
									{task.attachments.map((attachment) => (
										<FileContextMenu
											key={attachment.name}
											name={attachment.name}
											path={`${task.folderPath}/${attachment.name}`}
											onOpenFolder={share.openInOs}
											onRename={() => startRename(attachment.name)}
											onDelete={() => setDeletingFile(attachment.name)}
										>
											<TaskFileCard
												icon={artifactIcon(attachment.mime)}
												name={attachment.name}
												size={attachment.size}
												timestamp={attachment.mtime}
												onClick={() =>
													openArtifactMutation.mutate({ id: taskId, name: attachment.name })
												}
											/>
										</FileContextMenu>
									))}
								</div>
							</div>
						) : null}
					</div>
				</div>

				{task.worktree && task.project ? (
					<TaskMergeAction
						taskId={task.id}
						projectId={task.project.id}
						folderPath={task.folderPath}
						branch={task.worktree.branch}
						targetBranch={task.worktree.targetBranch}
						prUrl={task.worktree.prUrl}
					/>
				) : null}

				<ConfirmDialog
					open={renamingFile !== null}
					onClose={() => setRenamingFile(null)}
					onConfirm={confirmRename}
					title="Renomear arquivo"
					confirmLabel="Renomear"
					loading={renameFileMutation.isPending}
				>
					<Input
						// biome-ignore lint/a11y/noAutofocus: foco natural ao abrir o diálogo de renomear.
						autoFocus
						value={renameValue}
						onChange={(e) => setRenameValue(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								confirmRename();
							}
						}}
						placeholder="index.md"
					/>
				</ConfirmDialog>

				<ConfirmDialog
					open={deletingFile !== null}
					onClose={() => setDeletingFile(null)}
					onConfirm={() =>
						deletingFile && deleteFileMutation.mutate({ id: taskId, name: deletingFile })
					}
					title="Deletar arquivo"
					description={
						deletingFile ? `“${deletingFile}” será apagado permanentemente do disco.` : undefined
					}
					confirmLabel="Deletar"
					variant="danger"
					loading={deleteFileMutation.isPending}
				/>
			</div>
		</TaskOverviewContextMenu>
	);
}
