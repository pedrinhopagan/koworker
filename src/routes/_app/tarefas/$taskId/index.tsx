import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Copy, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { MarkdownEditor } from "@/components/markdown-doc";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedWrite } from "@/hooks/use-debounced-write";
import { cn } from "@/lib/utils";

import { buildKoworkerPrompt, copyToClipboard } from "./-components/build-prompt";

export const Route = createFileRoute("/_app/tarefas/$taskId/")({
	component: TaskDetailPage,
});

function TaskDetailPage() {
	const { taskId } = Route.useParams();
	const queryClient = useQueryClient();

	const taskQuery = useQuery(orpc.tasks.getFull.queryOptions({ input: { id: taskId } }));
	const task = taskQuery.data ?? null;

	const writeFileMutation = useMutation({
		...orpc.tasks.writeFile.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries(orpc.tasks.getFull.queryOptions({ input: { id: taskId } }));
		},
	});

	const { schedule, flush } = useDebouncedWrite((payload: { name: string; content: string }) =>
		writeFileMutation.mutateAsync({ id: taskId, ...payload }),
	);

	const [activeFile, setActiveFile] = useState<string | null>(null);
	const [userInput, setUserInput] = useState("");

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
			<div className="flex h-8 w-full items-stretch border-b border-border">
				<Link
					to="/tarefas"
					className="flex items-center px-4 text-muted-foreground transition-colors hover:text-foreground"
					aria-label="Voltar para tarefas"
				>
					<ArrowLeft size={16} />
				</Link>
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

			<footer className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 py-4">
				<Textarea
					value={userInput}
					onChange={(event) => setUserInput(event.target.value)}
					placeholder="Instrução opcional para o agente (vai junto do prompt)"
					className="min-h-16 resize-none"
				/>
				<Button onClick={() => void handleSendPrompt()} className="self-end">
					<Copy size={14} />
					Copiar prompt
				</Button>
			</footer>
		</div>
	);
}
