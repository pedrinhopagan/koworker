import { Loader2, MessagesSquare } from "lucide-react";

import { Text, Title } from "@/components/typography";
import { SessionUserMessage } from "@/components/agent-session/session-user-message";

// O primeiro turno demora o que o CLI demora para subir. A mensagem já aparece na conversa e o
// aviso abaixo dela é o mesmo "trabalhando" da sessão: quem envia do celular não vê tela em branco.
export function StartingThread({ text }: { text: string }) {
	return (
		<div className="mx-auto w-full max-w-3xl space-y-4 pt-4">
			<SessionUserMessage text={text} />
			<div className="flex items-center gap-2 border border-dashed border-primary px-3 py-3 text-primary">
				<Loader2 className="size-3.5 animate-spin" />
				<Text size="xs" tone="muted">
					Abrindo a sessão do agente…
				</Text>
			</div>
		</div>
	);
}

export function ChatWelcome({
	projectName,
	taskTitle,
}: {
	projectName?: string;
	taskTitle?: string;
}) {
	return (
		<div className="mx-auto flex h-full w-full max-w-3xl flex-col items-center justify-center gap-3 py-10 text-center">
			<span className="flex size-11 items-center justify-center border border-border bg-card shadow-[3px_3px_0_var(--border)]">
				<MessagesSquare className="size-5 text-primary" />
			</span>
			<Title size="lg" className="uppercase tracking-[0.12em]">
				{taskTitle ? "Próximo passo" : "Fale com o agente"}
			</Title>
			<Text tone="muted" className="max-w-md text-sm">
				{taskTitle
					? `A nova sessão começa lendo ${taskTitle}. Escreva apenas o que ela deve fazer agora.`
					: projectName
						? `A conversa abre uma sessão viva no ${projectName} e vira uma tarefa com os documentos do trabalho.`
						: "Escolha o projeto abaixo e escreva. A conversa abre uma sessão viva do CLI e vira uma tarefa."}
			</Text>
			<Text size="xs" tone="muted">
				/ insere uma skill · cole imagens · o microfone dita
			</Text>
		</div>
	);
}
