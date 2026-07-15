import { Check, ChevronRight, Loader2, Radio, Send, X } from "lucide-react";

import type { RouterOutputs } from "@/client";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { InvokeCli } from "@/constants/invoke";
import { AudioRecorder } from "./audio-recorder";

type Project = RouterOutputs["projects"]["list"][number];
type Task = RouterOutputs["tasks"]["listByProject"][number];

export function ExecutionComposer({
	projects,
	projectId,
	tasks,
	taskId,
	createTask,
	taskTitle,
	text,
	cli,
	selectedTask,
	canSubmit,
	pending,
	executorStatus,
	onProjectChange,
	onTaskChange,
	onTaskClear,
	onCreateTaskChange,
	onTaskTitleChange,
	onTextChange,
	onTranscribed,
	onSubmit,
}: {
	projects: Project[];
	projectId: string;
	tasks: Task[];
	taskId: string;
	createTask: boolean;
	taskTitle: string;
	text: string;
	cli: InvokeCli;
	selectedTask?: Task;
	canSubmit: boolean;
	pending: boolean;
	executorStatus: "checking" | "available" | "unavailable";
	onProjectChange: (value: string) => void;
	onTaskChange: (value: string) => void;
	onTaskClear: () => void;
	onCreateTaskChange: () => void;
	onTaskTitleChange: (value: string) => void;
	onTextChange: (value: string) => void;
	onTranscribed: (value: string) => void;
	onSubmit: () => void;
}) {
	return (
		<section className="min-w-0">
			<div className="mb-3 flex items-center justify-between border-y border-border py-2">
				<div className="flex items-center gap-2">
					<Radio className="size-4 text-primary" />
					<Text className="text-xs font-bold uppercase tracking-[0.14em]">Execução direta</Text>
				</div>
				<Text size="xs" tone="muted" className="flex items-center gap-1">
					<span
						className={
							executorStatus === "available"
								? "size-2 bg-emerald-500"
								: executorStatus === "unavailable"
									? "size-2 bg-destructive"
									: "size-2 animate-pulse bg-muted-foreground"
						}
					/>
					{executorStatus === "available"
						? "Servidor conectado"
						: executorStatus === "unavailable"
							? "Executor indisponível"
							: "Verificando executor"}
				</Text>
			</div>

			<div className="border border-border bg-card p-4 shadow-[5px_5px_0_var(--border)] md:p-6">
				<div className="grid gap-3 sm:grid-cols-2">
					<CustomSelect
						items={projects}
						value={projectId}
						onValueChange={onProjectChange}
						renderItem={(project) => <span>{project.name}</span>}
						placeholder="Escolha o projeto"
						upperLabel
						label="Projeto"
					/>
					<CustomSelect
						items={tasks}
						value={taskId}
						onValueChange={onTaskChange}
						renderItem={(task) => <span>{task.displayTitle}</span>}
						placeholder="Sem tarefa específica"
						upperLabel
						label="Tarefa"
						disabled={!projectId || createTask}
					/>
				</div>
				{taskId && !createTask && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={onTaskClear}
						className="mt-2 ml-auto flex"
					>
						<X className="size-3" />
						Executar sem tarefa
					</Button>
				)}

				<button
					type="button"
					aria-pressed={createTask}
					onClick={onCreateTaskChange}
					className="my-4 flex w-full items-center justify-between border border-border bg-muted/30 p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
				>
					<span className="flex items-center gap-3">
						<span className="flex size-5 items-center justify-center border border-border bg-background">
							{createTask && <Check className="size-3" />}
						</span>
						<span>
							<Text className="font-semibold">Salvar como nova tarefa</Text>
							<Text size="xs" tone="muted">
								Cria o contexto e despacha em uma operação.
							</Text>
						</span>
					</span>
					<ChevronRight className="size-4 text-muted-foreground" />
				</button>
				{createTask && (
					<Input
						value={taskTitle}
						onChange={(event) => onTaskTitleChange(event.target.value)}
						placeholder="Título da nova tarefa"
						className="mb-4"
						autoFocus
					/>
				)}

				<label htmlFor="execution-prompt">
					<Text className="mb-2 text-xs font-bold uppercase tracking-[0.14em]">Instrução</Text>
				</label>
				<Textarea
					id="execution-prompt"
					value={text}
					onChange={(event) => onTextChange(event.target.value)}
					placeholder="Descreva o resultado que o agente deve entregar… Use /skills quando precisar."
					className="min-h-48 resize-y text-base leading-7"
				/>
				<AudioRecorder onTranscribed={onTranscribed} />

				<div className="mt-5 flex items-center justify-between gap-4 border-t border-border pt-4">
					<Text size="xs" tone="muted">
						{cli === "codex" ? "Codex" : "Claude"} · unattended ·{" "}
						{selectedTask?.displayTitle ?? (createTask ? "nova tarefa" : "projeto")}
					</Text>
					<Button size="lg" onClick={onSubmit} disabled={!canSubmit || pending}>
						{pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
						{pending ? "Despachando" : "Executar agora"}
					</Button>
				</div>
			</div>
		</section>
	);
}
