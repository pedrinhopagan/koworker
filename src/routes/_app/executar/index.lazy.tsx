import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import { MessagesSquare, PanelRight } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { withoutInvokeInherit } from "@/constants/invoke";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { errorMessage } from "@/lib/orpc-errors";
import { usePromptBarStore } from "@/stores/prompt-bar";
import { ChatContextBar } from "./-components/chat-context-bar";
import { ChatWelcome, StartingThread } from "./-components/chat-start";
import { SessionsDrawer } from "./-components/sessions-drawer";
import { ThreadComposer } from "@/components/agent-session/thread-composer";

const EXECUTION_DRAFT_KEY = "kowork-execution-draft";

export const Route = createLazyFileRoute("/_app/executar/")({
	component: ExecutePage,
});

// A tela é a conversa: entrar aqui é abrir um chat vazio, e a primeira mensagem cria a sessão e
// leva para `/executar/<id>` já com a conversa carregada, sem passar por um carregamento no meio.
function ExecutePage() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const queryClient = useQueryClient();
	const { projects, selectedProjectId } = useProjectFocus();
	const cli = usePromptBarStore((state) => state.cli);
	const invoke = usePromptBarStore((state) => state.invoke);
	const [projectId, setProjectId] = useState(search.projectId ?? selectedProjectId ?? "");
	const [taskId, setTaskId] = useState(search.taskId ?? "");
	const [taskTitle, setTaskTitle] = useState("");
	const [sending, setSending] = useState<string | null>(null);
	const [drawerOpen, setDrawerOpen] = useState(false);

	useEffect(() => {
		if (!projectId && selectedProjectId) {
			setProjectId(selectedProjectId);
		}
	}, [projectId, selectedProjectId]);

	const tasksQuery = useQuery({
		...orpc.tasks.listByProject.queryOptions({ input: { projectId } }),
		enabled: !!projectId,
	});
	const categoriesQuery = useQuery(orpc.categories.list.queryOptions());
	const prioritiesQuery = useQuery(orpc.priorities.list.queryOptions());
	const groupsQuery = useQuery({
		...orpc.taskGroups.list.queryOptions({ input: { projectId } }),
		enabled: !!projectId,
	});
	const sessionsQuery = useQuery({
		...orpc.agentSessions.list.queryOptions({ input: { limit: 20 } }),
		refetchInterval: (query) =>
			query.state.data?.some((session) => session.status === "live") ? 5000 : false,
	});

	const selectedTask = tasksQuery.data?.find((task) => task.id === taskId);
	const selectedProject = projects.find((project) => project.id === projectId);
	const liveSessions =
		sessionsQuery.data?.filter((session) => session.status === "live").length ?? 0;

	const startMutation = useMutation({
		...orpc.agentSessions.start.mutationOptions(),
		onSuccess: async (session) => {
			// A conversa já vem inteira do servidor: semear o cache antes de navegar é o que faz a
			// transição parecer a mesma tela, com a mensagem enviada no lugar onde ela já estava.
			queryClient.setQueryData(
				orpc.agentSessions.get.queryOptions({ input: { sessionId: session.id } }).queryKey,
				session,
			);
			await queryClient.invalidateQueries({ queryKey: orpc.agentSessions.list.key() });
			await navigate({ to: "/executar/$executionId", params: { executionId: session.id } });
			setSending(null);
		},
		onError: (error) => {
			setSending(null);
			toast.error(errorMessage(error, "Não foi possível abrir a sessão"));
		},
	});

	function handleProjectChange(value: string) {
		setProjectId(value);
		setTaskId("");
		void navigate({ search: { projectId: value }, replace: true });
	}

	function handleSubmit(prompt: string, inputKind: "text" | "audio_transcript") {
		if (!selectedProject) {
			toast.error("Escolha o projeto antes de enviar");

			return;
		}

		const agentSession = cli === "codex" ? invoke.codex : invoke.claude;
		const model = withoutInvokeInherit(agentSession.model);
		const effort = withoutInvokeInherit(agentSession.effort);
		setSending(prompt);

		startMutation.mutate({
			projectId,
			prompt,
			originalPrompt: prompt,
			inputKind,
			cli,
			permissionMode:
				invoke.claude.permissionMode === "bypass"
					? "bypassPermissions"
					: invoke.claude.permissionMode,
			approvalMode: invoke.codex.approvalMode,
			// Toda conversa nasce amarrada a uma tarefa: ou a que você escolheu, ou uma nova, que o
			// agente batiza quando o título fica vazio. É o que garante os documentos do trabalho.
			...(selectedTask ? { taskId: selectedTask.id } : { createTaskTitle: taskTitle.trim() }),
			...(model ? { model } : {}),
			...(effort ? { effort } : {}),
		});
	}

	return (
		<PageShell
			title="Nova sessão"
			description={selectedProject?.name ?? "Escolha um projeto para começar"}
			icon={MessagesSquare}
			contentClassName="flex min-h-0 flex-col"
			actions={
				<Button variant="outline" size="sm" onClick={() => setDrawerOpen(true)}>
					<PanelRight className="size-4" />
					Conversas
					{liveSessions > 0 && (
						<span className="flex size-5 items-center justify-center border border-primary text-[11px] text-primary">
							{liveSessions}
						</span>
					)}
				</Button>
			}
		>
			<div className="flex min-h-0 flex-1 flex-col">
				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
					{sending ? (
						<StartingThread text={sending} />
					) : (
						<ChatWelcome
							{...(selectedProject ? { projectName: selectedProject.name } : {})}
							{...(selectedTask ? { taskTitle: selectedTask.displayTitle } : {})}
						/>
					)}
				</div>

				<ChatContextBar
					projects={projects}
					projectId={projectId}
					tasks={tasksQuery.data ?? []}
					categories={categoriesQuery.data ?? []}
					priorities={prioritiesQuery.data ?? []}
					groups={groupsQuery.data ?? []}
					tasksLoading={tasksQuery.isLoading}
					taskTitle={taskTitle}
					onProjectChange={handleProjectChange}
					onTaskChange={setTaskId}
					onTaskClear={() => setTaskId("")}
					onTaskTitleChange={setTaskTitle}
					{...(selectedTask ? { selectedTask } : {})}
				/>

				<ThreadComposer
					draftKey={EXECUTION_DRAFT_KEY}
					disabled={!projectId || !!sending}
					pending={startMutation.isPending}
					placeholder={
						selectedTask ? "O que a nova sessão deve fazer?" : "O que você quer executar?"
					}
					helperText={
						selectedTask
							? `A nova sessão lê ${selectedTask.displayTitle} antes de começar.`
							: "Ctrl+Enter envia · / insere uma skill · cole imagens."
					}
					hint={
						projectId
							? "Abrindo a sessão do agente…"
							: "Escolha o projeto na tira acima para começar."
					}
					onSubmit={handleSubmit}
					{...(selectedProject ? { projectName: selectedProject.name } : {})}
				/>
			</div>

			<SessionsDrawer
				open={drawerOpen}
				sessions={sessionsQuery.data ?? []}
				sessionsLoading={sessionsQuery.isLoading}
				onOpenChange={setDrawerOpen}
			/>
		</PageShell>
	);
}
