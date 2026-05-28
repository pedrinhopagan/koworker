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
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { DocEditorPane, type DocEditorPaneHandle } from "@/components/doc-editor-pane";
import { DocToolbar } from "@/components/doc-toolbar";
import {
	TASK_SELECT_CONTENT_SELECTOR,
	TaskMetaControls,
	TaskTitleInput,
} from "@/components/tasks/task-meta-controls";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RECENCY_HIGHLIGHT_DEPTH, recencyLevelClass } from "@/constants/tasks";
import { useClickOutside } from "@/hooks/use-click-outside";
import { relativeTimeFrom } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import { FileDateFooter } from "./-components/file-date-footer";

export const Route = createFileRoute("/_app/tarefas/$taskId/")({
	component: TaskDetailPage,
});

function TaskDetailPage() {
	const { taskId } = Route.useParams();
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const taskQuery = useQuery(orpc.tasks.getFull.queryOptions({ input: { id: taskId } }));
	const task = taskQuery.data ?? null;

	function invalidateTasks() {
		queryClient.invalidateQueries({
			predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "tasks",
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
		onSuccess: (result) => {
			queryClient.invalidateQueries(orpc.tasks.getFull.queryOptions({ input: { id: taskId } }));
			setActiveFile(result.newName);
			toast.success("Arquivo renomeado");
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao renomear arquivo"),
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
		onSuccess: () => {
			invalidateTasks();
			navigate({ to: "/tarefas" });
		},
	});

	const isMutating =
		setDoneMutation.isPending || updateMutation.isPending || removeTaskMutation.isPending;

	const [activeFile, setActiveFile] = useState<string | null>(null);
	const [editing, setEditing] = useState(false);
	const [renamingFile, setRenamingFile] = useState<string | null>(null);
	const [renameValue, setRenameValue] = useState("");
	const renameInputRef = useRef<HTMLInputElement>(null);
	const headerRef = useRef<HTMLDivElement>(null);
	const paneRef = useRef<DocEditorPaneHandle>(null);

	useClickOutside(headerRef, () => setEditing(false), {
		enabled: editing,
		ignoreSelector: TASK_SELECT_CONTENT_SELECTOR,
	});

	useEffect(() => {
		if (task && (!activeFile || !task.files.some((f) => f.name === activeFile))) {
			setActiveFile(task.primaryFile ?? task.files[0]?.name ?? null);
		}
	}, [task, activeFile]);

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
		setActiveFile(name);
	}

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
			<div className="w-full border-b border-border">
				<div ref={headerRef} className="mx-auto flex h-10 w-full max-w-6xl items-center gap-2 px-2">
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
								placeholder={task.displayTitle}
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
						categoryId={task.categoryId}
						priorityId={task.priorityId}
						editing={editing}
						disabled={isMutating}
						onToggleEdit={() => setEditing((value) => !value)}
						onCategoryChange={(categoryId) => updateMutation.mutate({ id: task.id, categoryId })}
						onPriorityChange={(priorityId) => updateMutation.mutate({ id: task.id, priorityId })}
						onDelete={() => removeTaskMutation.mutate({ id: task.id })}
					/>
					<div className="h-5 w-px bg-border" aria-hidden="true" />
					<DocToolbar
						onCollapse={() => paneRef.current?.collapseAll()}
						onExpand={() => paneRef.current?.expandAll()}
						onCopyContent={() => void paneRef.current?.copyContent()}
						onCopyPath={() => void paneRef.current?.copyPath()}
					/>
				</div>
			</div>

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
							{task.files.map((file) => (
								<SortableFileTab
									key={file.name}
									file={file}
									isActive={file.name === activeFile}
									// Ponto só quando há mais de um arquivo: com um só, "o mais recente" é trivial.
									level={task.files.length > 1 ? recencyLevels.get(file.name) : undefined}
									isRenaming={renamingFile === file.name}
									renameValue={renameValue}
									renameInputRef={renameInputRef}
									onSelect={() => void selectFile(file.name)}
									onStartRename={() => startRename(file.name)}
									onRenameChange={setRenameValue}
									onRenameConfirm={confirmRename}
									onRenameCancel={cancelRename}
								/>
							))}
						</div>
					</SortableContext>
				</DndContext>
			</div>

			<DocEditorPane
				ref={paneRef}
				fileName={activeFile}
				content={current?.content ?? ""}
				folderPath={task.folderPath}
				projectName={task.project?.name}
				writeFile={(payload) => writeFileMutation.mutateAsync({ id: taskId, ...payload })}
				emptyState="Nenhum arquivo markdown nesta tarefa."
			/>

			{current ? (
				<FileDateFooter
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
	);
}

type SortableFileTabProps = {
	file: { name: string; createdAt: number; editedAt: number };
	isActive: boolean;
	level: number | undefined;
	isRenaming: boolean;
	renameValue: string;
	renameInputRef: React.RefObject<HTMLInputElement | null>;
	onSelect: () => void;
	onStartRename: () => void;
	onRenameChange: (value: string) => void;
	onRenameConfirm: () => void;
	onRenameCancel: () => void;
};

function SortableFileTab({
	file,
	isActive,
	level,
	isRenaming,
	renameValue,
	renameInputRef,
	onSelect,
	onStartRename,
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
				<button
					type="button"
					onClick={onSelect}
					onDoubleClick={onStartRename}
					className={cn(
						"flex h-full w-full touch-none items-center justify-center gap-1.5 px-3 text-center text-xs transition-colors",
						!isActive && "hover:bg-secondary/50",
					)}
					title={`Criado ${relativeTimeFrom(file.createdAt)} · editado ${relativeTimeFrom(file.editedAt)} — arraste para reordenar · duplo clique para renomear`}
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
			)}
		</div>
	);
}
