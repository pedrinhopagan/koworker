import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Pencil, RefreshCw } from "lucide-react";
import { useState } from "react";
import { orpc } from "@/client";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { CONVERSATION_PERMISSIONS, CONVERSATION_PROFILES } from "@/constants/conversation";
import type { ConversationCreateInput } from "@/api/schemas/conversations";
import { ConversationComposer } from "@/routes/_app/chat/-components/conversation-composer";
import { ConversationModel } from "@/routes/_app/chat/-components/conversation-model";
import { ConversationTimeline } from "@/routes/_app/chat/-components/conversation-timeline";
import {
	useConversation,
	useConversationActions,
} from "@/routes/_app/chat/-utils/use-conversation";

export function ConversationDetail({ id, onOpenList }: { id: string; onOpenList: () => void }) {
	const { data: conversation, isPending, error, connected } = useConversation(id);
	const {
		send,
		sending,
		sendError,
		interrupt,
		interrupting,
		interruptError,
		reconcile,
		reconciling,
		reconcileError,
	} = useConversationActions(id);
	const [model, setModel] = useState<string>();
	const [effort, setEffort] = useState<ConversationCreateInput["effort"]>();
	const [renaming, setRenaming] = useState(false);
	const [title, setTitle] = useState("");
	const queryClient = useQueryClient();
	const {
		mutate: rename,
		isPending: savingTitle,
		error: titleError,
	} = useMutation(
		orpc.conversations.update.mutationOptions({
			onSuccess: () => {
				setRenaming(false);
				void queryClient.invalidateQueries(orpc.conversations.get.queryOptions({ input: { id } }));
				void queryClient.invalidateQueries(orpc.conversations.list.queryOptions());
			},
		}),
	);
	if (isPending) {
		return (
			<div className="flex flex-1 items-center justify-center gap-2">
				<Loader2 className="size-4 animate-spin" />
				<Text size="sm" tone="muted">
					Abrindo conversa
				</Text>
			</div>
		);
	}
	if (!conversation || error) {
		return (
			<div className="flex flex-1 flex-col items-center justify-center gap-4">
				<Title size="md">Não foi possível abrir a conversa</Title>
				<Text size="sm" tone="destructive">
					{error?.message}
				</Text>
				<Button variant="outline" asChild>
					<Link to="/chat" search={{}}>
						Voltar às conversas
					</Link>
				</Button>
			</div>
		);
	}
	const busy = !!conversation.projection.activeTurnId;
	const unresolved = conversation.messages.some(
		(message) => message.status === "uncertain" || message.status === "sending",
	);
	async function handleSend(draft: { text: string; clientMessageId: string }) {
		const result = await send({
			id,
			text: draft.text,
			clientMessageId: draft.clientMessageId,
			...(conversation?.projection.activeTurnId
				? { expectedTurnId: conversation.projection.activeTurnId }
				: {}),
			...(model ? { model } : {}),
			...(effort ? { effort } : {}),
		}).catch(() => null);
		return !!result?.messages.some(
			(message) =>
				message.id === draft.clientMessageId &&
				(message.status === "accepted" || message.status === "confirmed"),
		);
	}
	const handleReconcile = () => {
		void reconcile({ id }).catch(() => {});
	};
	return (
		<>
			<header className="flex shrink-0 items-start gap-2 border-b border-border bg-chrome px-3 py-2 sm:px-6 sm:py-3">
				<Button
					variant="ghost"
					size="icon"
					className="size-11 shrink-0 lg:hidden"
					onClick={onOpenList}
					aria-label="Voltar às conversas"
				>
					<ArrowLeft className="size-5" />
				</Button>
				<Button
					variant="ghost"
					size="icon"
					className="hidden size-11 shrink-0 lg:inline-flex"
					asChild
				>
					<Link to="/chat" search={{ view: "new" }} aria-label="Nova conversa">
						<ArrowLeft className="size-4" />
					</Link>
				</Button>
				<div className="min-w-0 flex-1 py-1">
					<Title size="md" className="line-clamp-2 break-words text-sm leading-snug sm:text-base">
						{conversation.title}
					</Title>
					<Text size="xs" tone="muted" className="mt-1 truncate">
						{conversation.projectName} · Codex{" "}
						{CONVERSATION_PROFILES.find((profile) => profile.id === conversation.profileId)?.label}
					</Text>
					<Text size="xs" tone="faint" className="mt-1">
						{!connected && "Reconectando · "}
						{conversation.projection.requests.length > 0 && "Esperando sua resposta"}
						{conversation.projection.requests.length === 0 && busy && "Trabalhando"}
						{conversation.projection.requests.length === 0 && !busy && "Pronto para sua mensagem"}
						<span className="hidden sm:inline">
							{" "}
							·{" "}
							{
								CONVERSATION_PERMISSIONS.find(
									(permission) => permission.id === conversation.permissionMode,
								)?.label
							}
						</span>
					</Text>
				</div>
				<div className="flex shrink-0">
					<Tooltip label="Renomear conversa">
						<Button
							variant="ghost"
							size="icon"
							aria-label="Renomear conversa"
							className="size-11"
							onClick={() => {
								setTitle(conversation.title);
								setRenaming(true);
							}}
						>
							<Pencil className="size-4" />
						</Button>
					</Tooltip>
					<Tooltip label="Conferir histórico">
						<Button
							variant="ghost"
							size="icon"
							aria-label="Conferir histórico"
							className="size-11"
							disabled={reconciling}
							onClick={handleReconcile}
						>
							{reconciling && <Loader2 className="size-4 animate-spin" />}
							{!reconciling && <RefreshCw className="size-4" />}
						</Button>
					</Tooltip>
				</div>
			</header>
			<ConversationTimeline
				conversation={conversation}
				onAnswer={
					connected && !unresolved
						? (text) => handleSend({ text, clientMessageId: crypto.randomUUID() })
						: undefined
				}
				onReconcile={handleReconcile}
				reconciling={reconciling}
			/>
			{unresolved && (
				<div className="mx-auto w-full max-w-3xl px-4 pb-2">
					<Text size="xs" tone="warning">
						Há uma mensagem com entrega a confirmar. Confira o histórico antes de enviar outra.
					</Text>
				</div>
			)}
			<ConversationComposer
				draftKey={`kowork:conversation-draft:${id}`}
				onSend={handleSend}
				pending={sending}
				disabled={!connected || (unresolved && !sending)}
				busy={busy}
				onInterrupt={() => {
					void interrupt({ id }).catch(() => {});
				}}
				interrupting={interrupting}
				error={sendError?.message ?? interruptError?.message ?? reconcileError?.message}
				controls={
					<ConversationModel
						profileId={conversation.profileId}
						model={model ?? conversation.model}
						effort={effort ?? conversation.effort}
						onModel={setModel}
						onEffort={setEffort}
						disabled={busy || sending}
					/>
				}
			/>
			<Dialog
				open={renaming}
				onClose={() => setRenaming(false)}
				title="Renomear conversa"
				footer={
					<Button
						disabled={!title.trim() || savingTitle}
						onClick={() => rename({ id, title: title.trim() })}
					>
						{savingTitle && <Loader2 className="size-4 animate-spin" />}Salvar
					</Button>
				}
			>
				<label htmlFor="conversation-title" className="mb-2 block text-sm">
					Título
				</label>
				<Input
					id="conversation-title"
					value={title}
					onChange={(event) => setTitle(event.target.value)}
					maxLength={200}
					autoFocus
				/>
				{titleError && (
					<Text size="sm" tone="destructive" className="mt-2">
						{titleError.message}
					</Text>
				)}
			</Dialog>
		</>
	);
}
