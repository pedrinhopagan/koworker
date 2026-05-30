import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { toast } from "sonner";

import { MarkdownEditor, type MarkdownEditorHandle } from "@/components/markdown-doc";
import { PromptInput, type PromptInputHandle } from "@/components/prompt-input";
import { Text } from "@/components/typography";
import { useDebouncedWrite } from "@/hooks/use-debounced-write";
import { buildKoworkerPrompt, copyToClipboard } from "@/lib/build-prompt";
import { cn } from "@/lib/utils";

// Superfície de edição compartilhada por tarefa e vault: o editor markdown, a barra de prompt
// com skills, o salvamento em debounce e a ponte editor↔prompt (mention de títulos). O header
// e seus controles ficam com a página; aqui mora só o que as duas telas têm igual.
export type DocEditorPaneHandle = {
	flush: () => Promise<void>;
	collapseAll: () => void;
	expandAll: () => void;
	copyContent: () => Promise<void>;
	copyPath: () => Promise<void>;
};

type DocEditorPaneProps = {
	// Identidade do arquivo aberto: remonta o editor e nomeia o alvo do salvamento/prompt.
	fileName: string | null;
	content: string;
	folderPath: string;
	projectName?: string;
	writeFile: (payload: { name: string; content: string }) => Promise<unknown>;
	emptyState?: string;
	// Modo leitura é controlado pela página (que decide o que dimmer/esconder no entorno);
	// aqui ele só amplia a fonte/largura, esconde o input e atende o Esc pra sair.
	reading: boolean;
	onExitReading: () => void;
};

export const DocEditorPane = forwardRef<DocEditorPaneHandle, DocEditorPaneProps>(
	function DocEditorPane(
		{ fileName, content, folderPath, projectName, writeFile, emptyState, reading, onExitReading },
		ref,
	) {
		const editorRef = useRef<MarkdownEditorHandle>(null);
		const promptInputRef = useRef<PromptInputHandle>(null);
		const [userInput, setUserInput] = useState("");

		const { schedule, flush } = useDebouncedWrite(writeFile);

		useEffect(() => {
			if (!reading) return;
			function onKey(event: KeyboardEvent) {
				if (event.key === "Escape") onExitReading();
			}
			window.addEventListener("keydown", onKey);
			return () => window.removeEventListener("keydown", onKey);
		}, [reading, onExitReading]);

		useImperativeHandle(ref, () => ({
			flush,
			collapseAll: () => editorRef.current?.collapseAll(),
			expandAll: () => editorRef.current?.expandAll(),
			async copyContent() {
				const value = editorRef.current?.getContent() ?? "";
				if (!value.trim()) {
					toast.info("Arquivo vazio");
					return;
				}
				const ok = await copyToClipboard(value);
				toast[ok ? "success" : "error"](ok ? "Conteúdo copiado" : "Falha ao copiar conteúdo");
			},
			async copyPath() {
				const target = fileName ? `${folderPath}/${fileName}` : folderPath;
				if (!target) return;
				const ok = await copyToClipboard(target);
				toast[ok ? "success" : "error"](ok ? "Caminho copiado" : "Falha ao copiar caminho");
			},
		}));

		async function handleInlineCodeCopy(text: string) {
			const ok = await copyToClipboard(text);
			toast[ok ? "success" : "error"](ok ? "Copiado" : "Não foi possível copiar");
		}

		async function handleSendPrompt() {
			await flush();
			const prompt = buildKoworkerPrompt({
				folderPath,
				fileName: fileName ?? undefined,
				userInput,
			});
			const copied = await copyToClipboard(prompt);
			toast[copied ? "success" : "error"](
				copied ? "Prompt copiado para a área de transferência" : "Não foi possível copiar o prompt",
			);
		}

		return (
			<>
				<main
					className={cn(
						"mx-auto flex w-full flex-1 flex-col gap-4 overflow-y-auto",
						reading
							? "max-w-4xl px-6 py-10 lg:max-w-5xl lg:px-10 2xl:max-w-6xl"
							: "max-w-3xl pt-6 pr-6 pb-6 pl-4 xl:max-w-4xl",
					)}
				>
					{fileName ? (
						<MarkdownEditor
							key={fileName}
							ref={editorRef}
							initialContent={content}
							fontSize={reading ? "1.25rem" : "1rem"}
							onChange={(next) => schedule({ name: fileName, content: next })}
							onInlineCodeClick={(text) => void handleInlineCodeCopy(text)}
							onHeadingMention={(text) => promptInputRef.current?.mention(text)}
						/>
					) : (
						<Text size="sm" tone="muted">
							{emptyState ?? "Nenhum arquivo markdown."}
						</Text>
					)}
				</main>

				{reading ? null : (
					<>
						<div className="border-t border-border" />

						<PromptInput
							ref={promptInputRef}
							value={userInput}
							onChange={setUserInput}
							onSend={() => void handleSendPrompt()}
							projectName={projectName}
						/>
					</>
				)}
			</>
		);
	},
);
