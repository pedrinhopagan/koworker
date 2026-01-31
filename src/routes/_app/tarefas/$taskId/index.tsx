import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { useMemo, useState } from "react";

import { orpc } from "@/client";
import { PageShell } from "@/components/layout/page-shell";
import { CategorySelect, PrioritySelect } from "@/components/tasks";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CustomSelect } from "@/components/ui/custom-select";
import { AGENTS, type AgentId, buildAgentCommand } from "@/desktop/agents";
import { tmuxNewWindow } from "@/desktop/tmux/client";
import { MODELS_BY_AGENT } from "@/lib/ai/models-catalog";
import { DEFAULT_SKILLS, type DefaultSkillId } from "@/lib/skills/default-skills";
import { cn } from "@/lib/utils";
import { useTaskTerminal } from "@/terminal/hooks";
import { TerminalMount } from "@/terminal/terminal-mount";
import { buildTmuxWindowScript } from "@/terminal/utils";

export const Route = createFileRoute("/_app/tarefas/$taskId/")({
	component: TaskDetailPage,
});

const PROJECT_ROOT = "/home/pedro/Documents/projects/kowork";

function TaskDetailPage() {
	const { taskId } = Route.useParams();
	const queryClient = useQueryClient();

	const taskQuery = useQuery(orpc.tasks.getById.queryOptions({ input: { id: taskId } }));
	const task = taskQuery.data ?? null;

	const updateTaskMutation = useMutation({
		...orpc.tasks.update.mutationOptions(),
		onSuccess: () => {
			// ORPC query keys are nested; invalidate all tasks queries.
			queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "tasks",
			});
		},
	});

	const executionQuery = useQuery(orpc.execution.getByTaskId.queryOptions({ input: { taskId } }));

	const executionMessages = useMemo(
		() => executionQuery.data?.messages ?? [],
		[executionQuery.data],
	);

	const [messageText, setMessageText] = useState("");
	const [detailsOpen, setDetailsOpen] = useState(true);
	const [executionOpen, setExecutionOpen] = useState(true);

	const {
		tmuxSessionName,
		terminalSessionId,
		terminalSessionActive,
		confirmCloseOpen,
		setConfirmCloseOpen,
		terminalIsCreating,
		terminalIsClosing,
		tmuxStatusText,
		ensureTerminalSession,
		handleTerminalClose,
	} = useTaskTerminal(taskId, PROJECT_ROOT);

	const defaultAgentId: AgentId = "codex";
	const [agentId, setAgentId] = useState<AgentId>(defaultAgentId);

	const allowedModels = MODELS_BY_AGENT[agentId];
	const canSelectModel = allowedModels.length > 0;

	const [model, setModel] = useState<string | undefined>(() => {
		const first = MODELS_BY_AGENT[defaultAgentId][0];
		return first ? first : undefined;
	});

	const [skill, setSkill] = useState<DefaultSkillId>("runner");

	const createMessageMutation = useMutation({
		...orpc.execution.createMessage.mutationOptions(),
		onSuccess: () => {
			setMessageText("");
			queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "execution",
			});
		},
	});

	if (taskQuery.isLoading) {
		return (
			<PageShell title="Tarefa" description="Carregando detalhes da tarefa..." icon={CheckCircle2}>
				<Text size="sm" tone="muted">
					Carregando tarefa...
				</Text>
			</PageShell>
		);
	}

	if (!task) {
		return (
			<PageShell title="Tarefa" description={`ID: ${taskId}`} icon={CheckCircle2}>
				<div className="space-y-3">
					<Text size="sm" tone="muted">
						Tarefa não encontrada.
					</Text>

					<Button variant="outline" asChild>
						<Link to="/tarefas" search={{ includeCompleted: true }}>
							Voltar para tarefas
						</Link>
					</Button>
				</div>
			</PageShell>
		);
	}

	return (
		<PageShell
			title={task.title}
			description={`ID: ${taskId}`}
			icon={CheckCircle2}
			actions={
				<div className="flex flex-wrap items-center gap-2">
					<CategorySelect
						value={task.categoryId}
						disabled={updateTaskMutation.isPending}
						onValueChange={(categoryId) => {
							updateTaskMutation.mutate({ id: taskId, categoryId });
						}}
					/>
					<PrioritySelect
						value={task.priorityId}
						disabled={updateTaskMutation.isPending}
						onValueChange={(priorityId) => {
							updateTaskMutation.mutate({ id: taskId, priorityId });
						}}
					/>
				</div>
			}
		>
			<div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden">
				<section className="min-h-0 flex flex-col gap-4 overflow-y-auto pr-2 pb-6">
					<CollapsibleSection
						title="Detalhes da tarefa"
						// subtitle={`ID: ${taskId}`}
						open={detailsOpen}
						onOpenChange={setDetailsOpen}
						contentClassName="space-y-2"
					>
						<Text size="sm" tone="muted">
							Comeca vazio. Conforme a tarefa for sendo modificada, os detalhes aparecem aqui.
						</Text>
						<div className="rounded-md border bg-background p-3 space-y-2">
							<Text size="xs" tone="muted">
								ID: {taskId}
							</Text>
							<Text size="sm" tone="muted">
								(placeholder)
							</Text>
						</div>
					</CollapsibleSection>

					<CollapsibleSection
						title="Execution Thread"
						// subtitle={executionSubtitle}
						open={executionOpen}
						onOpenChange={setExecutionOpen}
						contentClassName="space-y-3"
					>
						<div className="max-h-80 overflow-y-auto space-y-2">
							{executionQuery.isLoading && (
								<Text size="sm" tone="muted">
									Carregando mensagens...
								</Text>
							)}
							{!executionQuery.isLoading && executionMessages.length === 0 && (
								<Text size="sm" tone="muted">
									Nenhuma mensagem ainda.
								</Text>
							)}
							{!executionQuery.isLoading &&
								executionMessages.length > 0 &&
								executionMessages.map((m) => (
									<div key={m.id} className="rounded-md bg-muted/30 p-2">
										<div className="flex items-center justify-between gap-2">
											<Text size="xs" tone="muted">
												{m.role}
											</Text>
											<Text size="xs" tone="muted">
												{new Date(m.createdAt).toLocaleString()}
											</Text>
										</div>
										<Text size="sm">{m.content}</Text>
									</div>
								))}
						</div>

						<div className="border-t pt-3 space-y-2">
							<div className="flex flex-wrap items-center gap-2">
								<CustomSelect
									items={AGENTS}
									value={agentId}
									disabled={createMessageMutation.isPending}
									onValueChange={(nextAgentId) => {
										setAgentId(nextAgentId as AgentId);
										const models = MODELS_BY_AGENT[nextAgentId as AgentId];
										setModel(models[0] ?? undefined);
									}}
									label="Agent"
									renderTrigger={() => {
										const selected = AGENTS.find((a) => a.id === agentId);
										return <span className="truncate">{selected?.nome ?? agentId}</span>;
									}}
									renderItem={(item, isSelected) => (
										<div
											className={cn(
												"w-full flex items-center justify-between gap-2",
												isSelected && "font-medium",
											)}
										>
											<span className="truncate">{item.nome}</span>
											<span className="text-xs text-muted-foreground">{item.id}</span>
										</div>
									)}
									triggerClassName="flex-1"
								/>

								<CustomSelect
									items={allowedModels.map((m) => ({ id: m }))}
									value={model}
									disabled={createMessageMutation.isPending || !canSelectModel}
									onValueChange={(nextModel) => setModel(nextModel)}
									label="Model"
									placeholder={canSelectModel ? "Model" : "Default (agent)"}
									renderTrigger={() => (
										<span className="truncate">
											{model ?? (canSelectModel ? "Model" : "Default (agent)")}
										</span>
									)}
									renderItem={(item, isSelected) => (
										<div className={cn("w-full truncate", isSelected && "font-medium")}>
											{item.id}
										</div>
									)}
									triggerClassName="flex-1"
								/>

								<CustomSelect
									items={Object.values(DEFAULT_SKILLS)}
									value={skill}
									disabled={createMessageMutation.isPending}
									onValueChange={(nextSkillId) => setSkill(nextSkillId as DefaultSkillId)}
									label="Skill"
									renderTrigger={() => {
										const selected = DEFAULT_SKILLS[skill];
										return <span className="truncate">{selected?.name ?? skill}</span>;
									}}
									renderItem={(item, isSelected) => (
										<div className="w-full min-w-0">
											<div className={cn("truncate", isSelected && "font-medium")}>{item.name}</div>
											<div className="text-xs text-muted-foreground line-clamp-2">
												{item.description}
											</div>
										</div>
									)}
									triggerClassName="min-w-[160px]"
								/>
							</div>

							<textarea
								className="w-full min-h-24 resize-y rounded-md border bg-background p-2 text-sm"
								placeholder="Escreva uma mensagem..."
								value={messageText}
								onChange={(e) => setMessageText(e.target.value)}
								disabled={createMessageMutation.isPending}
							/>

							<div className="flex items-center justify-end gap-2">
								<Button
									disabled={createMessageMutation.isPending || messageText.trim().length === 0}
									onClick={async () => {
										const rawContent = messageText;
										const content = rawContent.trim();
										if (!content) return;

										await createMessageMutation.mutateAsync({
											taskId,
											content: rawContent,
											agentId,
											model: model && model.trim().length > 0 ? model : undefined,
											skill,
										});

										if (agentId) {
											if (canSelectModel && (!model || model.trim().length === 0)) return;

											const sessionId = await ensureTerminalSession();
											if (!sessionId) return;

											const skillPromptBase = DEFAULT_SKILLS[skill]?.promptBase ?? "";
											const prompt = `${skillPromptBase}\n\n${rawContent}`.trim();

											const built = buildAgentCommand({
												agentId,
												model: model && model.trim().length > 0 ? model : undefined,
												prompt,
											});

											if (!built.cmd || built.cmd.trim().length === 0) return;

											const windowName = `exec-${Date.now()}`;
											const script = buildTmuxWindowScript(built);

											await tmuxNewWindow({
												session: tmuxSessionName,
												name: windowName,
												cwd: PROJECT_ROOT,
												cmd: ["bash", "-lc", script],
											});
										}
									}}
								>
									Enviar
								</Button>
							</div>
						</div>
					</CollapsibleSection>
				</section>

				<section className="min-h-0 flex flex-col overflow-hidden">
					<div className="rounded-md border bg-background p-3 flex flex-col min-h-0 h-full">
						<div className="flex items-center justify-between gap-2">
							<div className="flex items-center gap-2 min-w-0">
								<Title as="h3" size="sm" className="truncate">
									Terminal
								</Title>
								<Text size="xs" tone="muted" className="truncate">
									Sessao: {tmuxSessionName}
								</Text>
							</div>
							<div className="flex items-center gap-2">
								{terminalSessionActive && (
									<Button
										variant="outline"
										size="sm"
										onClick={() => setConfirmCloseOpen(true)}
										disabled={terminalIsClosing}
									>
										Encerrar
									</Button>
								)}
								{!terminalSessionActive && (
									<Button
										size="sm"
										disabled={terminalIsCreating}
										onClick={async () => {
											await ensureTerminalSession();
										}}
									>
										{terminalIsCreating ? "Abrindo..." : "Abrir Terminal"}
									</Button>
								)}
							</div>
						</div>

						<div className="flex flex-wrap items-center justify-between gap-2 pt-2">
							<Text size="xs" tone="muted">
								ID: {taskId}
							</Text>
							<Text size="xs" tone="muted">
								{tmuxStatusText}
							</Text>
						</div>

						<div className="flex-1 min-h-0 pt-3">
							{terminalSessionId && <TerminalMount taskId={taskId} visible />}

							{!terminalSessionId && (
								<div className="flex h-full items-center justify-center">
									<Text size="sm" tone="muted">
										{terminalIsCreating
											? "Conectando ao terminal..."
											: "Abra um terminal embutido para rodar comandos no contexto do projeto."}
									</Text>
								</div>
							)}
						</div>
					</div>
				</section>
			</div>
			<ConfirmDialog
				open={confirmCloseOpen}
				onClose={() => setConfirmCloseOpen(false)}
				onConfirm={handleTerminalClose}
				title="Encerrar terminal"
				description="Isso encerra a sessão tmux da tarefa e termina os processos em execução."
				confirmLabel="Encerrar"
				cancelLabel="Cancelar"
				variant="danger"
				loading={terminalIsClosing}
			/>
		</PageShell>
	);
}
