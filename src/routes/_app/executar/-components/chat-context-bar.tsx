import { Bot, FolderKanban, ListTree, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import type { RouterOutputs } from "@/client";
import { ProjectPickerDialog } from "@/components/projects/project-picker-dialog";
import { Text, Title } from "@/components/typography";
import { Input } from "@/components/ui/input";
import { CODEX_MODEL_OPTIONS, INVOKE_MODEL_OPTIONS, INVOKE_CLI_OPTIONS } from "@/constants/invoke";
import { usePromptBarStore } from "@/stores/prompt-bar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ExecutionSettings } from "./execution-settings";
import { ExecutionTaskPicker } from "./execution-task-picker";

type Project = RouterOutputs["projects"]["list"][number];
type Task = RouterOutputs["tasks"]["listByProject"][number];
type Category = RouterOutputs["categories"]["list"][number];
type Priority = RouterOutputs["priorities"]["list"][number];
type TaskGroup = RouterOutputs["taskGroups"]["list"][number];

function Chip({
	icon,
	label,
	onClick,
}: {
	icon: React.ReactNode;
	label: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="flex h-8 min-w-0 shrink-0 items-center gap-2 border border-border bg-card px-2.5 text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
		>
			{icon}
			<span className="max-w-40 truncate">{label}</span>
		</button>
	);
}

// A tira de contexto responde "com quem estou falando e sobre o quê" sem tirar a conversa da tela:
// tudo o que era formulário virou três fichas acima do campo de escrever.
export function ChatContextBar({
	projects,
	projectId,
	tasks,
	categories,
	priorities,
	groups,
	tasksLoading,
	selectedTask,
	taskTitle,
	onProjectChange,
	onTaskChange,
	onTaskClear,
	onTaskTitleChange,
}: {
	projects: Project[];
	projectId: string;
	tasks: Task[];
	categories: Category[];
	priorities: Priority[];
	groups: TaskGroup[];
	tasksLoading: boolean;
	selectedTask?: Task;
	taskTitle: string;
	onProjectChange: (value: string) => void;
	onTaskChange: (value: string) => void;
	onTaskClear: () => void;
	onTaskTitleChange: (value: string) => void;
}) {
	const [projectOpen, setProjectOpen] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const cli = usePromptBarStore((state) => state.cli);
	const invoke = usePromptBarStore((state) => state.invoke);
	const session = cli === "codex" ? invoke.codex : invoke.claude;
	const modelOptions = cli === "codex" ? CODEX_MODEL_OPTIONS : INVOKE_MODEL_OPTIONS;
	const modelLabel = modelOptions.find((option) => option.value === session.model)?.label;
	const cliLabel = INVOKE_CLI_OPTIONS.find((option) => option.value === cli)?.label ?? cli;
	const selectedProject = projects.find((project) => project.id === projectId);

	return (
		<>
			<div className="mx-auto flex w-full max-w-3xl items-center gap-2 overflow-x-auto pb-2">
				<Chip
					icon={
						selectedProject ? (
							<span
								className="size-3 shrink-0"
								style={{ backgroundColor: selectedProject.color }}
							/>
						) : (
							<FolderKanban className="size-3.5 shrink-0 text-muted-foreground" />
						)
					}
					label={selectedProject?.name ?? "Escolher projeto"}
					onClick={() => setProjectOpen(true)}
				/>
				<Chip
					icon={<ListTree className="size-3.5 shrink-0 text-muted-foreground" />}
					label={selectedTask?.displayTitle ?? (taskTitle.trim() || "Nova tarefa")}
					onClick={() => setSettingsOpen(true)}
				/>
				<Chip
					icon={<Bot className="size-3.5 shrink-0 text-muted-foreground" />}
					label={modelLabel ? `${cliLabel} · ${modelLabel}` : cliLabel}
					onClick={() => setSettingsOpen(true)}
				/>
			</div>

			<ProjectPickerDialog
				open={projectOpen}
				onClose={() => setProjectOpen(false)}
				projects={projects.map((project) => ({
					id: project.id,
					name: project.name,
					color: project.color,
					displayPath: project.displayPath,
				}))}
				value={projectId}
				onSelect={(value) => {
					onProjectChange(value);
					setProjectOpen(false);
				}}
			/>

			<Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
				<SheetContent side="bottom" className="overflow-y-auto p-0">
					<SheetHeader className="border-b border-border px-4 py-4 pr-12 text-left sm:px-6">
						<div className="mx-auto w-full max-w-3xl">
							<SheetTitle asChild>
								<Title size="md" className="flex items-center gap-2">
									<SlidersHorizontal className="size-4 text-primary" />
									Ajustes da conversa
								</Title>
							</SheetTitle>
							<Text size="sm" tone="muted" className="mt-1">
								Valem a partir da próxima mensagem enviada.
							</Text>
						</div>
					</SheetHeader>

					<div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-5 sm:px-6">
						<section className="flex flex-col gap-3">
							<Title as="h3" size="sm">
								Agente
							</Title>
							<ExecutionSettings />
						</section>

						<section className="flex flex-col gap-3 border-t border-border pt-5">
							<div>
								<Title as="h3" size="sm">
									Tarefa
								</Title>
								<Text size="sm" tone="muted" className="mt-1">
									Toda conversa fica guardada numa pasta de tarefa do projeto.
								</Text>
							</div>
							<ExecutionTaskPicker
								tasks={tasks}
								categories={categories}
								priorities={priorities}
								groups={groups}
								selectedTask={selectedTask}
								disabled={!projectId}
								loading={tasksLoading}
								onChange={onTaskChange}
								onClear={onTaskClear}
							/>
							{!selectedTask && (
								<div className="flex flex-col gap-1.5">
									<Text
										as="span"
										size="xs"
										className="font-semibold uppercase tracking-[0.14em] text-muted-foreground"
									>
										Título da tarefa nova
									</Text>
									<Input
										aria-label="Título da tarefa nova"
										value={taskTitle}
										onChange={(event) => onTaskTitleChange(event.target.value)}
										placeholder="Deixe vazio para o agente batizar"
										className="h-10"
									/>
								</div>
							)}
						</section>
					</div>
				</SheetContent>
			</Sheet>
		</>
	);
}
