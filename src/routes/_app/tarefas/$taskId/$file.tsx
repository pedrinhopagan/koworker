import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	horizontalListSortingStrategy,
	SortableContext,
	useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { DocEditorPane, type DocEditorPaneHandle } from "@/components/doc-editor-pane";
import { DocToolbar } from "@/components/doc-toolbar";
import { FileContextMenu } from "@/components/file-context-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
	TASK_SELECT_CONTENT_SELECTOR,
	TaskMetaControls,
	TaskTitleInput,
	taskTitlePlaceholder,
} from "@/components/tasks/task-meta-controls";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip } from "@/components/ui/tooltip";
import { RECENCY_HIGHLIGHT_DEPTH, recencyLevelClass } from "@/constants/tasks";
import { useClickOutside } from "@/hooks/use-click-outside";
import { useRecordDocSession } from "@/hooks/use-record-doc-session";
import { useSetDoneMutation } from "@/hooks/use-set-done-mutation";
import { copyMarkdown, joinPath, openFolderInOs, shareFolderAsZip } from "@/lib/os-share";
import { reflowMarkdown } from "@/lib/reflow-markdown";
import { relativeTimeFrom } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import { docSessionKey } from "@/stores/doc-sessions";
import { useReadingModeStore } from "@/stores/reading-mode";
import { FileDatePopover } from "./-components/file-date-popover";
import { FlowRunButton } from "./-components/flow-run-button";

export const Route = createFileRoute("/_app/tarefas/$taskId/$file")({
	component: TaskFilePage,
});

function TaskFilePage() {
	const { taskId, file: activeFile } = Route.useParams();
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const taskQuery = useQuery(orpc.tasks.getFull.queryOptions({ input: { id: taskId } }));
	const task = taskQuery.data ?? null;

	const { pinned, togglePin } = useRecordDocSession(
		task
			? {
					key: docSessionKey({ kind: "task", taskId, file: activeFile }),
					kind: "task",
					title: task.displayTitle,
					subtitle: activeFile,
					projectName: task.project?.name,
					projectId: task.project?.id,
					nav: { to: "/tarefas/$taskId/$file", params: { taskId, file: activeFile } },
				}
			: null,
		{ completed: task?.done ?? false },
	);

	function invalidateTasks() {
		queryClient.invalidateQueries({
			predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "tasks",
		});
	}

	function openFile(name: string, options?: { replace?: boolean }) {
		navigate({
			to: "/tarefas/$taskId/$file",
			params: { taskId, file: name },
			replace: options?.replace,
		});
	}

	const writeFileMutation = useMutation({
		...orpc.tasks.writeFile.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries(orpc.tasks.getFull.queryOptions({ input: { id: taskId } }));
		},
	});

	const renameFileMutation = useMutation({
		...orpc.tasks.renameFile.mutationOptions(),
		onSuccess: async (result) => {
			await queryClient.invalidateQueries(
				orpc.tasks.getFull.queryOptions({ input: { id: taskId } }),
			);
			openFile(result.newName, { replace: true });
			toast.success("Arquivo renomeado");
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao renomear arquivo"),
	});

	const deleteFileMutation = useMutation({
		...orpc.tasks.deleteFile.mutationOptions(),
		onSuccess: async (_result, variables) => {
			await queryClient.invalidateQueries(
				orpc.tasks.getFull.queryOptions({ input: { id: taskId } }),
			);
			setDeletingFile(null);
			toast.success("Arquivo deletado");
			// Apagar o arquivo aberto deixa a URL órfã: volta pro index, que reescolhe o
			// primário (ou mostra o empty-state se a tarefa ficou sem arquivos).
			if (variables.name === activeFile) {
				navigate({ to: "/tarefas/$taskId", params: { taskId }, replace: true });
			}
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao deletar arquivo"),
	});

	const reorderFilesMutation = useMutation({
		...orpc.tasks.reorderFiles.mutationOptions(),
		onMutate: async ({ orderedNames }) => {
			const { queryKey } = orpc.tasks.getFull.queryOptions({ input: { id: taskId } });
			await queryClient.cancelQueries({ queryKey });
			const previous = queryClient.getQueryData(queryKey);
			const orderIndex = new Map(orderedNames.map((name, index) => [name, index] as const));

			queryClient.setQueryData(queryKey, (old?: typeof task) => {
				if (!old) return old;
				const files = [...old.files].sort(
					(a, b) => (orderIndex.get(a.name) ?? 0) - (orderIndex.get(b.name) ?? 0),
				);
				return { ...old, files };
			});
			return { previous, queryKey };
		},
		onError: (_error, _input, context) => {
			if (context) queryClient.setQueryData(context.queryKey, context.previous);
		},
		onSettled: () => {
			queryClient.invalidateQueries(orpc.tasks.getFull.queryOptions({ input: { id: taskId } }));
		},
	});

	const fileSensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
	);

	const setDoneMutation = useSetDoneMutation();

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

	const isMutating =
		setDoneMutation.isPending || updateMutation.isPending || removeTaskMutation.isPending;

	const [editing, setEditing] = useState(false);
	const reading = useReadingModeStore((s) => s.reading);
	const setReading = useReadingModeStore((s) => s.setReading);
	const [renamingFile, setRenamingFile] = useState<string | null>(null);
	const [deletingFile, setDeletingFile] = useState<string | null>(null);
	const [renameValue, setRenameValue] = useState("");
	const [creatingFile, setCreatingFile] = useState(false);
	const [newFileValue, setNewFileValue] = useState("");
	const renameInputRef = useRef<HTMLInputElement>(null);
	const newFileInputRef = useRef<HTMLInputElement>(null);
	const headerRef = useRef<HTMLDivElement>(null);
	const paneRef = useRef<DocEditorPaneHandle>(null);

	// O modo leitura vive num store (o footer global o lê pra ficar sutil); reseta ao sair da página.
	useEffect(() => () => setReading(false), [setReading]);

	useClickOutside(headerRef, () => setEditing(false), {
		enabled: editing,
		ignoreSelector: TASK_SELECT_CONTENT_SELECTOR,
	});

	useEffect(() => {
		const files = task?.files;
		if (!files?.length) {
			return;
		}
		async function handleKeyDown(e: KeyboardEvent) {
			if (!e.ctrlKey || e.key < "1" || e.key > "9") {
				return;
			}
			const target = files![Number(e.key) - 1];
			if (!target) {
				return;
			}
			e.preventDefault();
			await paneRef.current?.flush();
			openFile(target.name);
		}
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [task?.files, taskId]);

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

	// Param sem arquivo correspondente (deep-link velho, ou a janela curta entre apagar/renomear
	// o arquivo aberto e a URL acompanhar): cai no render normal com as abas e o painel vazio —
	// recuperável, como antes — em vez de uma tela "não encontrado" que piscaria no meio da operação.
	const current = task.files.find((f) => f.name === activeFile) ?? null;

	// Ranking de recência dos .md por mtime (1 = editado por último, mais forte), mesmo idioma
	// visual da lista de tarefas. Sem corte de janela: o tempo relativo no tooltip é o que mantém
	// o sinal honesto quando o "mais recente" é, ainda assim, antigo.
	const recencyLevels = new Map(
		[...task.files]
			.sort((a, b) => b.editedAt - a.editedAt)
			.slice(0, RECENCY_HIGHLIGHT_DEPTH)
			.map((file, index) => [file.name, index + 1] as const),
	);

	async function selectFile(name: string) {
		await paneRef.current?.flush();
		openFile(name);
	}

	// Caminho absoluto da pasta da tarefa (raiz do projeto + folder_path) pros comandos do SO.
	// Sem projeto (tarefa órfã) o menu Compartilhar não aparece.
	const folderAbs = task.project ? joinPath(task.project.mainRoute, task.folderPath) : null;

	// Copiar conteúdo = todos os .md da tarefa concatenados. Salva o pendente antes pra incluir a
	// última edição do arquivo aberto, e busca fresco (a concatenação canônica vive no backend).
	const copyTaskContent = async () => {
		if (!task.project) return;
		await paneRef.current?.flush();
		try {
			const result = await queryClient.fetchQuery({
				...orpc.vault.exportContent.queryOptions({
					input: { projectId: task.project.id, target: { kind: "task", taskId } },
				}),
				staleTime: 0,
			});
			await copyMarkdown(result.content);
		} catch {
			toast.error("Não foi possível exportar o conteúdo");
		}
	};

	const copyTaskZip = async () => {
		if (!folderAbs) return;
		await paneRef.current?.flush();
		await shareFolderAsZip(folderAbs);
	};

	function startCreate() {
		setCreatingFile(true);
		setNewFileValue("");
		setTimeout(() => newFileInputRef.current?.focus(), 0);
	}

	function cancelCreate() {
		setCreatingFile(false);
		setNewFileValue("");
	}

	const confirmCreate = async () => {
		const raw = newFileValue.trim();
		if (!raw) {
			cancelCreate();
			return;
		}
		const name = raw.endsWith(".md") ? raw : `${raw}.md`;
		if (task.files.some((f) => f.name === name)) {
			toast.error("Já existe um arquivo com esse nome");
			return;
		}
		await paneRef.current?.flush();
		await writeFileMutation.mutateAsync({ id: taskId, name, content: "" });
		// Aguarda o refetch antes de navegar: sem a aba nova em task.files, o guard de
		// "arquivo não encontrado" piscaria ao apontar a URL pro arquivo recém-criado.
		await queryClient.invalidateQueries(orpc.tasks.getFull.queryOptions({ input: { id: taskId } }));
		openFile(name);
		setCreatingFile(false);
		setNewFileValue("");
	};

	function startRename(name: string) {
		setRenamingFile(name);
		setRenameValue(name);
		setTimeout(() => renameInputRef.current?.select(), 0);
	}

	function cancelRename() {
		setRenamingFile(null);
		setRenameValue("");
	}

	function confirmRename() {
		const newName = renameValue.trim();
		if (!newName || !renamingFile || newName === renamingFile) {
			cancelRename();
			return;
		}
		if (!newName.endsWith(".md")) {
			toast.error("O nome deve terminar em .md");
			return;
		}
		renameFileMutation.mutate({ id: taskId, oldName: renamingFile, newName });
		cancelRename();
	}

	const saveTitle = (value: string) => {
		const next = value.trim();
		if (next === (task.title ?? "")) return;
		updateMutation.mutate({ id: task.id, title: next });
	};

	function handleFileDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		if (!task || !over || active.id === over.id) return;

		const names = task.files.map((file) => file.name);
		const oldIndex = names.indexOf(String(active.id));
		const newIndex = names.indexOf(String(over.id));
		if (oldIndex < 0 || newIndex < 0) return;

		reorderFilesMutation.mutate({ id: taskId, orderedNames: arrayMove(names, oldIndex, newIndex) });
	}

	return (
		<div className="relative flex h-full w-full flex-col">
			{reading ? null : (
				<div className="w-full border-b border-border">
					<div
						ref={headerRef}
						className="mx-auto flex h-10 w-full max-w-6xl items-center gap-2 px-2"
					>
						<Link
							to="/tarefas"
							className="flex items-center px-2 text-muted-foreground transition-colors hover:text-foreground"
							aria-label="Voltar para tarefas"
						>
							<ArrowLeft size={16} />
						</Link>
						<Checkbox
							checked={task.done}
							onCheckedChange={(checked) =>
								setDoneMutation.mutate({ id: task.id, done: checked === true })
							}
							disabled={isMutating}
							aria-label={task.done ? "Marcar como não concluída" : "Marcar como concluída"}
						/>
						{editing ? (
							<div className="min-w-0 flex-1">
								<TaskTitleInput
									initialValue={task.title ?? ""}
									placeholder={taskTitlePlaceholder(task)}
									onSave={saveTitle}
									onCancel={() => setEditing(false)}
								/>
							</div>
						) : (
							<Text
								size="sm"
								className={cn(
									"min-w-0 flex-1 truncate font-medium",
									task.done && "text-muted-foreground line-through",
								)}
							>
								{task.displayTitle}
							</Text>
						)}
						<TaskMetaControls
							categoryId={task.categoryId ?? null}
							priorityId={task.priorityId ?? null}
							complexity={task.complexity}
							editing={editing}
							disabled={isMutating}
							onToggleEdit={() => setEditing((value) => !value)}
							onCategoryChange={(categoryId) => updateMutation.mutate({ id: task.id, categoryId })}
							onPriorityChange={(priorityId) => updateMutation.mutate({ id: task.id, priorityId })}
							onComplexityChange={(complexity) =>
								updateMutation.mutate({ id: task.id, complexity })
							}
							onDelete={() => removeTaskMutation.mutate({ id: task.id })}
						/>
						<FlowRunButton taskId={taskId} />
						<div className="h-5 w-px bg-border" aria-hidden="true" />
						<DocToolbar
							onCollapse={() => paneRef.current?.collapseAll()}
							onExpand={() => paneRef.current?.expandAll()}
							onCopyContent={() => void paneRef.current?.copyContent()}
							onCopyPath={() => void paneRef.current?.copyPath()}
							onReading={() => setReading(true)}
							pinned={pinned}
							onTogglePin={togglePin}
							share={
								folderAbs
									? {
											onOpenInOs: () => void openFolderInOs(folderAbs),
											onCopyContent: () => void copyTaskContent(),
											onCopyZip: () => void copyTaskZip(),
										}
									: undefined
							}
						/>
						{current ? (
							<FileDatePopover
								taskId={taskId}
								file={current}
								onChanged={() =>
									queryClient.invalidateQueries(
										orpc.tasks.getFull.queryOptions({ input: { id: taskId } }),
									)
								}
							/>
						) : null}
					</div>
				</div>
			)}

			{/* Na leitura este wrapper vira overlay em tela cheia (cobre a navegação do app, header
			    e rodapé) com as tabs no topo; fora dela é `display:contents`, então tabs e editor
			    seguem no fluxo normal. A ordem dos filhos não muda, pra o CodeMirror não remontar. */}
			<div className={reading ? "fixed inset-0 z-50 flex flex-col bg-background" : "contents"}>
				<div className="w-full border-b border-border">
					<DndContext
						sensors={fileSensors}
						collisionDetection={closestCenter}
						onDragEnd={handleFileDragEnd}
					>
						<SortableContext
							items={task.files.map((file) => file.name)}
							strategy={horizontalListSortingStrategy}
						>
							<div className="mx-auto flex h-8 w-full max-w-6xl items-stretch">
								{/* No modo leitura as tabs perdem destaque, mas seguem navegáveis pra trocar de
							    arquivo sem sair da leitura; o dim mora aqui pra não atingir o botão de sair. */}
								<div
									className={cn(
										"flex min-w-0 flex-1 items-stretch transition-opacity",
										reading && "opacity-40 hover:opacity-100",
									)}
								>
									{task.files.map((file) => (
										<SortableFileTab
											key={file.name}
											file={file}
											path={`${task.folderPath}/${file.name}`}
											isActive={file.name === activeFile}
											// Ponto só quando há mais de um arquivo: com um só, "o mais recente" é trivial.
											level={task.files.length > 1 ? recencyLevels.get(file.name) : undefined}
											isRenaming={renamingFile === file.name}
											renameValue={renameValue}
											renameInputRef={renameInputRef}
											onSelect={() => void selectFile(file.name)}
											onStartRename={() => startRename(file.name)}
											onRequestDelete={() => setDeletingFile(file.name)}
											onRenameChange={setRenameValue}
											onRenameConfirm={confirmRename}
											onRenameCancel={cancelRename}
										/>
									))}
									{creatingFile ? (
										<div className="min-w-0 flex-1 border-l border-border bg-secondary text-foreground">
											<input
												ref={newFileInputRef}
												value={newFileValue}
												onChange={(e) => setNewFileValue(e.target.value)}
												onBlur={() => void confirmCreate()}
												onKeyDown={(e) => {
													if (e.key === "Enter") void confirmCreate();
													else if (e.key === "Escape") cancelCreate();
												}}
												placeholder="novo-arquivo.md"
												className="h-full w-full bg-transparent px-3 text-center text-xs outline-none placeholder:text-muted-foreground"
											/>
										</div>
									) : null}
								</div>
								{reading ? (
									<button
										type="button"
										onClick={() => setReading(false)}
										className="flex shrink-0 items-center gap-1.5 border-l border-border px-3 text-xs text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
										title="Sair do modo leitura (Esc)"
									>
										<X size={14} />
										Sair da leitura
									</button>
								) : creatingFile ? null : (
									<Tooltip label="Novo arquivo" triggerClassName="inline-flex shrink-0">
										<button
											type="button"
											onClick={startCreate}
											className="flex shrink-0 items-center justify-center border-l border-border px-3 text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
											aria-label="Novo arquivo"
										>
											<Plus size={14} />
										</button>
									</Tooltip>
								)}
							</div>
						</SortableContext>
					</DndContext>
				</div>

				<DocEditorPane
					ref={paneRef}
					fileName={creatingFile ? null : activeFile}
					sessionKey={docSessionKey({ kind: "task", taskId, file: activeFile })}
					content={creatingFile ? "" : reflowMarkdown(current?.content ?? "")}
					folderPath={task.folderPath}
					writeFile={(payload) => writeFileMutation.mutateAsync({ id: taskId, ...payload })}
					emptyState={
						creatingFile
							? "Defina o título da nova aba para criar o arquivo."
							: "Nenhum arquivo markdown nesta tarefa."
					}
					reading={reading}
					onExitReading={() => setReading(false)}
					onExit={() => navigate({ to: "/tarefas" })}
				/>
			</div>

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
	);
}

type SortableFileTabProps = {
	file: { name: string; createdAt: number; editedAt: number };
	// Caminho do arquivo relativo à raiz do projeto, pra ação "Copiar caminho" do menu de contexto.
	path: string;
	isActive: boolean;
	level: number | undefined;
	isRenaming: boolean;
	renameValue: string;
	renameInputRef: React.RefObject<HTMLInputElement | null>;
	onSelect: () => void;
	onStartRename: () => void;
	onRequestDelete: () => void;
	onRenameChange: (value: string) => void;
	onRenameConfirm: () => void;
	onRenameCancel: () => void;
};

function SortableFileTab({
	file,
	path,
	isActive,
	level,
	isRenaming,
	renameValue,
	renameInputRef,
	onSelect,
	onStartRename,
	onRequestDelete,
	onRenameChange,
	onRenameConfirm,
	onRenameCancel,
}: SortableFileTabProps) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: file.name,
		// Renomeando não arrasta: o input precisa do gesto de seleção/teclado livre.
		disabled: isRenaming,
	});

	const style: React.CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition,
		zIndex: isDragging ? 1 : undefined,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn(
				"min-w-0 flex-1 border-l border-border",
				isActive ? "bg-secondary text-foreground" : "text-muted-foreground",
				isDragging && "opacity-60",
			)}
		>
			{isRenaming ? (
				<input
					ref={renameInputRef}
					value={renameValue}
					onChange={(e) => onRenameChange(e.target.value)}
					onBlur={onRenameConfirm}
					onKeyDown={(e) => {
						if (e.key === "Enter") onRenameConfirm();
						else if (e.key === "Escape") onRenameCancel();
					}}
					className="h-full w-full bg-transparent px-3 text-center text-xs outline-none"
				/>
			) : (
				<FileContextMenu
					name={file.name}
					path={path}
					onRename={onStartRename}
					onDelete={onRequestDelete}
				>
					<button
						type="button"
						onClick={onSelect}
						onDoubleClick={onStartRename}
						className={cn(
							"flex h-full w-full touch-none items-center justify-center gap-1.5 px-3 text-center text-xs transition-colors",
							!isActive && "hover:bg-secondary/50",
						)}
						title={`Criado ${relativeTimeFrom(file.createdAt)} · editado ${relativeTimeFrom(file.editedAt)} — arraste para reordenar · duplo clique ou botão direito para renomear`}
						{...attributes}
						{...(listeners as React.HTMLAttributes<HTMLButtonElement>)}
					>
						{level === undefined ? null : (
							<span
								className={cn("size-1.5 shrink-0 rounded-full", recencyLevelClass(level))}
								aria-hidden
							/>
						)}
						<span className="truncate">{file.name}</span>
					</button>
				</FileContextMenu>
			)}
		</div>
	);
}
