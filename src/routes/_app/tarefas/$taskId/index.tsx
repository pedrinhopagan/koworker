import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { MarkdownEditor } from "@/components/markdown-doc";
import {
	TASK_SELECT_CONTENT_SELECTOR,
	TaskMetaControls,
	TaskTitleInput,
} from "@/components/tasks/task-meta-controls";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useClickOutside } from "@/hooks/use-click-outside";
import { useDebouncedWrite } from "@/hooks/use-debounced-write";
import { cn } from "@/lib/utils";

import { buildKoworkerPrompt, copyToClipboard } from "./-components/build-prompt";
import { PromptInput } from "./-components/prompt-input";

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

	const { schedule, flush } = useDebouncedWrite((payload: { name: string; content: string }) =>
		writeFileMutation.mutateAsync({ id: taskId, ...payload }),
	);

	const [activeFile, setActiveFile] = useState<string | null>(null);
	const [userInput, setUserInput] = useState("");
	const [editing, setEditing] = useState(false);
	const headerRef = useRef<HTMLDivElement>(null);

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
	const folderPath = task.folderPath;

	async function selectFile(name: string) {
		await flush();
		setActiveFile(name);
	}

	const saveTitle = (value: string) => {
		const next = value.trim();
		if (next === (task.title ?? "")) return;
		updateMutation.mutate({ id: task.id, title: next });
	};

	async function handleSendPrompt() {
		await flush();

		const prompt = buildKoworkerPrompt({
			folderPath,
			fileName: activeFile ?? undefined,
			userInput,
		});
		const copied = await copyToClipboard(prompt);
		if (copied) {
			toast.success("Prompt copiado para a área de transferência");
		} else {
			toast.error("Não foi possível copiar o prompt");
		}
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
				</div>
			</div>

			<div className="w-full border-b border-border">
				<div className="mx-auto flex h-8 w-full max-w-6xl items-stretch">
					{task.files.map((file) => (
						<button
							key={file.name}
							type="button"
							onClick={() => void selectFile(file.name)}
							className={cn(
								"min-w-0 flex-1 truncate border-l border-border px-3 text-center text-xs leading-8 transition-colors",
								file.name === activeFile
									? "bg-secondary text-foreground"
									: "text-muted-foreground hover:bg-secondary/50",
							)}
						>
							{file.name}
						</button>
					))}
				</div>
			</div>

			<main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 overflow-y-auto px-4 pt-6 pb-6">
				{current ? (
					<MarkdownEditor
						key={current.name}
						initialContent={current.content}
						onChange={(content) => schedule({ name: current.name, content })}
					/>
				) : (
					<Text size="sm" tone="muted">
						Nenhum arquivo markdown nesta tarefa.
					</Text>
				)}
			</main>

			<div className="border-t border-border" />

			<PromptInput
				value={userInput}
				onChange={setUserInput}
				onSend={() => void handleSendPrompt()}
				projectName={task.project?.name}
			/>
		</div>
	);
}
