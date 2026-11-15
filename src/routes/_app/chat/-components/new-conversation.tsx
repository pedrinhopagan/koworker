import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Folder, MessageSquare } from "lucide-react";
import { useState } from "react";
import { orpc } from "@/client";
import { Text, Title } from "@/components/typography";
import { CustomSelect } from "@/components/ui/custom-select";
import {
	CONVERSATION_DEFAULT_PERMISSION,
	CONVERSATION_PERMISSIONS,
	CONVERSATION_PROFILES,
} from "@/constants/conversation";
import { useProjectFocus } from "@/hooks/use-project-focus";
import type { ConversationCreateInput } from "@/api/schemas/conversations";
import { ConversationComposer } from "@/routes/_app/chat/-components/conversation-composer";
import { ConversationModel } from "@/routes/_app/chat/-components/conversation-model";

export function NewConversation() {
	const { projects, explicitProject, setSelectedProjectId, loading } = useProjectFocus();
	const [projectId, setProjectId] = useState<string>();
	const project = projects.find((entry) => entry.id === (projectId ?? explicitProject?.id));
	const [profileId, setProfileId] = useState<ConversationCreateInput["profileId"]>("default");
	const [permissionMode, setPermissionMode] = useState<ConversationCreateInput["permissionMode"]>(
		CONVERSATION_DEFAULT_PERMISSION,
	);
	const [model, setModel] = useState<string>();
	const [effort, setEffort] = useState<ConversationCreateInput["effort"]>();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const {
		mutateAsync: create,
		isPending: creating,
		error: createError,
	} = useMutation(orpc.conversations.create.mutationOptions());
	const {
		mutateAsync: send,
		isPending: sending,
		error: sendError,
	} = useMutation(orpc.conversations.send.mutationOptions());

	async function handleSend(draft: { text: string; clientMessageId: string }) {
		if (!project) {
			return false;
		}
		const conversation = await create({
			projectId: project.id,
			profileId,
			permissionMode,
			...(model ? { model } : {}),
			...(effort ? { effort } : {}),
		}).catch(() => null);
		if (!conversation) {
			return false;
		}
		const result = await send({
			id: conversation.id,
			text: draft.text,
			clientMessageId: draft.clientMessageId,
			...(model ? { model } : {}),
			...(effort ? { effort } : {}),
		}).catch(() => null);
		const delivered = result?.messages.some(
			(message) =>
				message.id === draft.clientMessageId &&
				(message.status === "accepted" || message.status === "confirmed"),
		);
		if (!delivered) {
			try {
				localStorage.setItem(`kowork:conversation-draft:${conversation.id}`, JSON.stringify(draft));
			} catch {}
		}
		try {
			localStorage.removeItem("kowork:conversation-draft:new");
		} catch {}
		await queryClient.invalidateQueries(orpc.conversations.list.queryOptions());
		await navigate({ to: "/chat", search: { id: conversation.id } });
		return true;
	}

	return (
		<div
			data-component="new-chat"
			className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain sm:justify-center"
		>
			<div className="new-chat-intro mx-auto w-full max-w-3xl px-6 pt-8 pb-6 text-center sm:pt-12 sm:pb-8">
				<MessageSquare className="mx-auto mb-5 size-8 text-primary" />
				<Title size="xl" className="text-2xl sm:text-3xl">
					O que vamos construir?
				</Title>
				<Text size="sm" tone="muted" className="mt-3">
					Escolha um projeto e comece uma conversa com o Codex.
				</Text>
			</div>
			<div className="mx-auto mb-4 flex w-full max-w-3xl flex-wrap items-center justify-center gap-2 px-3">
				<CustomSelect
					items={projects}
					value={project?.id ?? ""}
					onValueChange={(value) => {
						setProjectId(value);
						setSelectedProjectId(value);
					}}
					renderItem={(project) => (
						<span className="flex items-center gap-2">
							<Folder className="size-3.5" />
							{project.name}
						</span>
					)}
					fitContent
					variant="ghost"
					ariaLabel="Projeto da conversa"
					placeholder="Selecionar projeto"
					loading={loading}
					disabled={creating || sending}
					className="h-11 max-w-60 px-3"
				/>
				<CustomSelect
					items={[...CONVERSATION_PROFILES]}
					value={profileId}
					onValueChange={(_id, entry) => {
						setProfileId(entry.id);
						setModel(undefined);
						setEffort(undefined);
					}}
					renderItem={(profile) => `Codex · ${profile.label}`}
					fitContent
					variant="ghost"
					ariaLabel="Conta do Codex"
					disabled={creating || sending}
					className="h-11 px-3"
				/>
			</div>
			<ConversationComposer
				draftKey="kowork:conversation-draft:new"
				onSend={handleSend}
				pending={creating || sending}
				disabled={!project}
				error={createError?.message ?? sendError?.message}
				controls={
					<>
						<ConversationModel
							profileId={profileId}
							model={model}
							effort={effort}
							onModel={setModel}
							onEffort={setEffort}
							disabled={creating || sending}
						/>
						<CustomSelect
							items={[...CONVERSATION_PERMISSIONS]}
							value={permissionMode}
							onValueChange={(_id, entry) => setPermissionMode(entry.id)}
							renderItem={(entry) => entry.label}
							fitContent
							variant="ghost"
							ariaLabel="Permissões da conversa"
							disabled={creating || sending}
							className="h-11 px-2 sm:h-9"
						/>
					</>
				}
			/>
			{!project && (
				<Text size="xs" tone="muted" className="pb-8 text-center">
					Selecione o projeto para enviar sua mensagem.
				</Text>
			)}
		</div>
	);
}
