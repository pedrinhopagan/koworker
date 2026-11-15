import { Loader2, SquareTerminal } from "lucide-react";
import { ModelPicker } from "@/components/agent-session/model-picker";
import { OutgoingPrompts } from "@/components/agent-session/outgoing-prompts";
import { ThreadComposer } from "@/components/agent-session/thread-composer";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { ConversationThread } from "@/routes/_app/chat/-components/conversation-thread";
import { ConversationViewport } from "@/routes/_app/chat/-components/conversation-viewport";
import { useConversationPane } from "@/routes/_app/chat/-utils/use-conversation-pane";

export function ConversationLive({
	paneId,
	onOpenTerminal,
}: {
	paneId: string;
	onOpenTerminal: () => void;
}) {
	const pane = useConversationPane(paneId);
	const closed = !pane.agent && !pane.radarLoading && !pane.inTransit;
	return (
		<div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
			{!pane.connected && !closed && (
				<Text role="status" size="xs" tone="warning" className="shrink-0 px-4 py-2">
					Reconectando ao computador…
				</Text>
			)}
			{pane.blocked && (
				<div
					role="alert"
					className="flex shrink-0 items-center gap-3 border-b border-border bg-warning/5 px-4 py-2"
				>
					<Text size="xs" className="flex-1">
						O agent espera sua resposta no terminal.
					</Text>
					<Button variant="outline" size="sm" className="min-h-11" onClick={onOpenTerminal}>
						<SquareTerminal className="size-4" />
						Abrir terminal
					</Button>
				</div>
			)}
			<ConversationViewport identity={pane.identity} cwd={pane.cwd}>
				{pane.loading && pane.turns.length === 0 && !closed && (
					<div
						role="status"
						className="flex h-32 items-center justify-center gap-2 text-muted-foreground"
					>
						<Loader2 className="size-4 animate-spin" />
						<Text size="sm">Lendo conversa</Text>
					</div>
				)}
				{closed && (
					<EmptyFeedback
						icon={SquareTerminal}
						title="Pane fechado"
						subtitle="Abra outro agent na sidebar para continuar."
					/>
				)}
				{!pane.loading && pane.turns.length === 0 && !closed && !pane.error && (
					<EmptyFeedback
						icon={SquareTerminal}
						title="Comece a conversa"
						subtitle="Envie uma mensagem para este agent."
					/>
				)}
				<ConversationThread turns={pane.turns} onAnswer={pane.blocked ? undefined : pane.submit} />
				<OutgoingPrompts
					items={pane.outgoing}
					queueHint={
						pane.agent?.agent === "codex"
							? "Alt+↑ no terminal traz de volta para editar"
							: "↑ no terminal edita a fila"
					}
					onDismiss={pane.dismiss}
					onOpenTerminal={onOpenTerminal}
				/>
				{pane.error && (
					<div role="alert" className="border border-destructive/40 p-3">
						<Text size="sm" tone="destructive">
							{pane.error}
						</Text>
						<Button variant="ghost" size="sm" onClick={pane.retry}>
							Tentar novamente
						</Button>
					</div>
				)}
				{pane.busy && !pane.blocked && (
					<Text role="status" size="xs" tone="muted" className="flex items-center gap-2">
						<Loader2 className="size-3.5 animate-spin" />O agent está trabalhando
					</Text>
				)}
			</ConversationViewport>
			{pane.inTransit && (
				<Text role="status" size="xs" tone="muted" className="px-4 py-2">
					Transferindo a conversa para o novo agent…
				</Text>
			)}
			<ThreadComposer
				draftKey={`kowork-radar-draft-${paneId}`}
				projectName={pane.agent?.projectName ?? undefined}
				cli={pane.agent?.agent}
				disabled={closed || pane.blocked || pane.inTransit || !pane.ready}
				pending={pane.pending}
				disabledHintInline
				hint={closed ? "Esta sessão foi fechada." : "Conectando ao computador…"}
				helperText={
					pane.busy ? "A mensagem entra na fila do agent sem interromper o trabalho." : ""
				}
				onSubmit={pane.submit}
				accessory={
					pane.agent &&
					pane.model.session.cli && (
						<ModelPicker
							catalog={pane.model.catalog}
							session={pane.model.session}
							value={pane.model.target}
							onChange={pane.model.change}
							status={pane.model.status}
							allowCliChange
							disabled={pane.inTransit}
						/>
					)
				}
			/>
		</div>
	);
}
