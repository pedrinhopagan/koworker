import { Check, Copy, Expand, X } from "lucide-react";
import { memo, useMemo, useState } from "react";

import { agentCliVisual } from "@/components/agent-radar/agent-cli";
import { MarkdownEditor } from "@/components/markdown-doc";
import { MarkdownView } from "@/components/markdown-view";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDateTime, relativeTimeFrom } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

const PREVIEW_LINES = 16;

// A ficha da fala: o que dá pra afirmar sobre esta mensagem sem inventar. Tudo é opcional porque a
// mesma resposta aparece na conversa de uma sessão (que sabe o CLI e o horário) e no histórico de
// uma execução avulsa (que às vezes só tem o texto).
export type AgentAnswerMeta = {
	// Slug da CLI que respondeu — vira ícone de marca e nome no cabeçalho do leitor.
	agent?: string;
	// Quando o bloco foi gravado, em ms.
	at?: number;
	// Posição do bloco na conversa; é a identidade que o merge do transcript usa.
	seq?: number;
	// Contexto de onde a fala nasceu, quando o chamador conhece.
	projectName?: string;
	taskTitle?: string;
};

function countWords(text: string) {
	const matched = text.trim().match(/\S+/g);
	return matched ? matched.length : 0;
}

// Ficha de leitura da mensagem: tamanho, blocos de código e horário. É o que o cabeçalho do leitor
// mostra abaixo do nome do agent, e o que dá noção do que se está prestes a ler.
function useAnswerFacts(output: string, meta: AgentAnswerMeta) {
	return useMemo(() => {
		const lines = output.split("\n");
		const fences = lines.filter((line) => line.trimStart().startsWith("```")).length;
		const facts: string[] = [];

		if (meta.seq !== undefined) {
			facts.push(`Bloco #${meta.seq}`);
		}
		if (meta.at) {
			facts.push(formatDateTime(meta.at));
		}
		facts.push(`${countWords(output).toLocaleString("pt-BR")} palavras`);
		facts.push(`${lines.length.toLocaleString("pt-BR")} linhas`);
		if (fences >= 2) {
			const blocks = Math.floor(fences / 2);
			facts.push(blocks === 1 ? "1 bloco de código" : `${blocks} blocos de código`);
		}

		return facts;
	}, [output, meta.at, meta.seq]);
}

// A resposta chega em markdown e é lida pelo mesmo motor do leitor de `.md` (`MarkdownView`), então
// heading, negrito, lista, régua, tabela e código aparecem formatados dentro da própria conversa. O
// que a conversa não comporta é um leitor com rolagem própria por turno — no celular dois scrolls
// empilhados brigam pelo toque —, então o texto flui na altura natural e o leitor completo, com o
// editor de verdade, abre sob demanda e só é montado quando abre.
export const AgentAnswer = memo(function AgentAnswer({
	runId,
	output,
	meta = {},
}: {
	runId: string;
	output: string;
	meta?: AgentAnswerMeta;
}) {
	const [reading, setReading] = useState(false);
	const [expanded, setExpanded] = useState(false);
	const [copied, setCopied] = useState(false);
	const long = output.split("\n").length > PREVIEW_LINES || output.length > 1_400;
	const facts = useAnswerFacts(output, meta);
	const cli = meta.agent ? agentCliVisual(meta.agent) : null;

	async function copyOutput() {
		try {
			await navigator.clipboard.writeText(output);
			setCopied(true);
			setTimeout(() => setCopied(false), 1_500);
		} catch {
			setCopied(false);
		}
	}

	return (
		<div className="min-w-0">
			<div
				className={
					expanded || !long
						? "min-w-0"
						: "relative min-w-0 max-h-72 overflow-hidden after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-16 after:bg-gradient-to-t after:from-card after:to-transparent"
				}
			>
				<MarkdownView key={runId} text={output} className="text-[15px]" />
			</div>

			<div className="mt-3 flex flex-wrap items-center gap-2">
				{long && !expanded && (
					<Button variant="outline" size="sm" onClick={() => setExpanded(true)}>
						Ver resposta inteira
					</Button>
				)}
				<Button variant="ghost" size="sm" onClick={() => setReading(true)}>
					<Expand className="size-4" />
					Abrir no leitor
				</Button>
			</div>

			{reading && (
				<Sheet open onOpenChange={setReading}>
					<SheetContent
						side="bottom"
						showClose={false}
						className="h-[94dvh] max-h-[94dvh] pb-[env(safe-area-inset-bottom)]"
					>
						<SheetHeader className="flex-row items-start justify-between gap-3 border-b border-border bg-card px-4 py-3">
							<div className="flex min-w-0 items-start gap-3">
								<span
									className={cn(
										"flex size-9 shrink-0 items-center justify-center rounded-full",
										cli ? cn("bg-muted", cli.tone) : "bg-primary/10 text-primary",
									)}
								>
									{cli ? <cli.icon className="size-4.5" /> : <Expand className="size-4" />}
								</span>

								<div className="min-w-0">
									<SheetTitle asChild>
										<Title as="h2" size="sm" className="truncate">
											{cli?.label ?? "Resposta do agente"}
										</Title>
									</SheetTitle>

									<Text size="xs" tone="muted" className="mt-0.5">
										{facts.join(" · ")}
									</Text>

									{(meta.projectName || meta.taskTitle || meta.at) && (
										<Text size="xs" tone="muted" className="mt-0.5 truncate">
											{[
												meta.projectName,
												meta.taskTitle,
												meta.at ? relativeTimeFrom(meta.at) : null,
											]
												.filter(Boolean)
												.join(" · ")}
										</Text>
									)}
								</div>
							</div>

							<div className="flex shrink-0 items-center gap-2">
								<Button
									variant="outline"
									size="icon"
									onClick={copyOutput}
									aria-label="Copiar resposta"
									className="size-11 border-border bg-background text-foreground hover:bg-muted hover:text-foreground"
								>
									{copied ? <Check className="size-5" /> : <Copy className="size-5" />}
								</Button>
								<Button
									variant="outline"
									size="icon"
									onClick={() => setReading(false)}
									aria-label="Fechar leitor"
									className="size-11 border-border bg-background text-foreground hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
								>
									<X className="size-5" />
								</Button>
							</div>
						</SheetHeader>
						<div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-4 [&_.cm-scroller]:touch-pan-y [&_.cm-scroller]:overflow-y-auto [&_.cm-scroller]:overscroll-contain md:px-6">
							<MarkdownEditor
								initialContent={output}
								onChange={() => {}}
								proseMaxWidth="48rem"
								readOnly
							/>
						</div>
					</SheetContent>
				</Sheet>
			)}
		</div>
	);
});
