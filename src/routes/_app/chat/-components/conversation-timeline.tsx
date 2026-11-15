import { Loader2 } from "lucide-react";
import type { RouterOutputs } from "@/client";
import { MarkdownView } from "@/components/markdown-view";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { CONVERSATION_MESSAGE_LABELS } from "@/constants/conversation";
import { ConversationRequestCard } from "@/routes/_app/chat/-components/conversation-request";
import { ConversationThread } from "@/routes/_app/chat/-components/conversation-thread";
import { ConversationViewport } from "@/routes/_app/chat/-components/conversation-viewport";

export function ConversationTimeline({
	conversation,
	onAnswer,
	onReconcile,
	reconciling,
}: {
	conversation: RouterOutputs["conversations"]["get"];
	onAnswer?: (text: string) => Promise<boolean>;
	onReconcile: () => void;
	reconciling: boolean;
}) {
	const { projection } = conversation;
	const confirmed = new Set(
		projection.turns.flatMap((turn) => turn.items.map((item) => item.clientId)),
	);
	const pending = conversation.messages.filter(
		(message) => message.status !== "confirmed" && !confirmed.has(message.id),
	);
	return (
		<ConversationViewport identity={conversation.id} cwd={conversation.cwd}>
			{projection.turns.length === 0 && pending.length === 0 && (
				<div className="py-16 text-center">
					<Title size="lg">Comece por uma ideia</Title>
					<Text size="sm" tone="muted" className="mt-2">
						Peça uma mudança, uma revisão ou ajuda com o projeto.
					</Text>
				</div>
			)}
			<ConversationThread turns={projection.turns} onAnswer={onAnswer} />
			{pending.map((message) => (
				<div
					key={message.id}
					className="ml-auto min-w-0 max-w-[90%] border border-border bg-secondary/50 px-4 py-3"
				>
					<MarkdownView text={message.text} className="text-sm" />
					<Text size="xs" tone="muted" className="mt-2">
						{CONVERSATION_MESSAGE_LABELS[message.status]}
					</Text>
					{message.error && (
						<Text size="xs" tone="destructive" className="mt-1">
							{message.error}
						</Text>
					)}
					{(message.status === "uncertain" || message.status === "sending") && (
						<Button variant="ghost" size="sm" disabled={reconciling} onClick={onReconcile}>
							Conferir entrega
						</Button>
					)}
				</div>
			))}
			{projection.requests.map((request) => (
				<ConversationRequestCard
					key={`${request.runtimeId}:${request.id}`}
					conversationId={conversation.id}
					request={request}
				/>
			))}
			{projection.activeTurnId && projection.requests.length === 0 && (
				<Text role="status" size="xs" tone="muted" className="flex items-center gap-2">
					<Loader2 className="size-3.5 animate-spin" />O Codex está trabalhando
				</Text>
			)}
			{projection.diff && (
				<details className="border border-border">
					<summary className="min-h-11 cursor-pointer px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
						Ver alterações da execução
					</summary>
					<pre className="max-h-96 overflow-auto px-4 pb-4 font-mono text-xs whitespace-pre-wrap break-words">
						{projection.diff}
					</pre>
				</details>
			)}
			{projection.error && projection.turns.at(-1)?.error?.message !== projection.error && (
				<Text role="alert" size="sm" tone="destructive">
					{projection.error}
				</Text>
			)}
		</ConversationViewport>
	);
}
