import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { toast } from "sonner";

import { MarkdownEditor, type MarkdownEditorHandle } from "@/components/markdown-doc";
import { Text } from "@/components/typography";
import { useDebouncedWrite } from "@/hooks/use-debounced-write";
import { copyToClipboard } from "@/lib/build-prompt";
import type { HeadingAnchor } from "@/lib/heading-anchor";
import { cn } from "@/lib/utils";
import { useDocSessionsStore } from "@/stores/doc-sessions";
import { usePromptBarStore } from "@/stores/prompt-bar";

// Superfície de edição compartilhada por tarefa e vault: o editor markdown, o salvamento em
// debounce e a ponte editor→prompt global (mention de títulos). O header e seus controles ficam
// com a página; aqui mora só o que as telas têm igual. O prompt agora é o footer global.
export type DocEditorPaneHandle = {
	flush: () => Promise<void>;
	getContent: () => string;
	collapseAll: () => void;
	expandAll: () => void;
	copyContent: () => Promise<void>;
	copyPath: () => Promise<void>;
};

type DocEditorPaneProps = {
	// Identidade do arquivo aberto: remonta o editor e nomeia o alvo do salvamento/prompt.
	fileName: string | null;
	// Chave estável do documento (independente da URL) pra indexar a memória de ponto de leitura.
	sessionKey: string;
	content: string;
	folderPath: string;
	writeFile: (payload: { name: string; content: string }) => Promise<unknown>;
	emptyState?: string;
	// Modo leitura é controlado pela página (que decide o que dimmer/esconder no entorno);
	// aqui ele só amplia a fonte/largura e atende o Esc pra sair.
	reading: boolean;
	onExitReading: () => void;
	// Repassado ao editor: colar markdown com frontmatter roteia metadados pros controles da página.
	onPasteFrontmatter?: (frontmatter: Record<string, unknown>, body: string) => void;
	// Esc fora da leitura "sai pra valer": volta uma rota (a página informa o alvo do pop). O pane cuida
	// do resto do modelo §5 — salva o que estava pendente e remove a sessão do MRU (salvo se fixada).
	onExit: () => void;
};

export const DocEditorPane = forwardRef<DocEditorPaneHandle, DocEditorPaneProps>(
	function DocEditorPane(
		{
			fileName,
			sessionKey,
			content,
			folderPath,
			writeFile,
			emptyState,
			reading,
			onExitReading,
			onExit,
			onPasteFrontmatter,
		},
		ref,
	) {
		const editorRef = useRef<MarkdownEditorHandle>(null);

		// Na leitura o footer do prompt é fixo sobre o conteúdo; --prompt-bar-h (publicada pelo footer
		// via ResizeObserver) garante que o scroll alcance o texto que ficaria atrás do drawer.

		const { schedule, flush } = useDebouncedWrite(writeFile);

		// Lido uma vez por remount (o editor é keyado por arquivo); `getState` evita re-render reativo.
		const initialAnchor = useMemo(
			() => useDocSessionsStore.getState().getAnchor(sessionKey),
			[sessionKey],
		);
		const saveAnchor = useCallback(
			(anchor: HeadingAnchor) => useDocSessionsStore.getState().saveAnchor(sessionKey, anchor),
			[sessionKey],
		);

		// Esc em dois estágios, num único listener (sem dois handlers competindo pelo mesmo Esc):
		//   1. no modo leitura → sai da leitura e fica na página.
		//   2. fora da leitura → "saí pra valer": salva o pendente, remove a sessão do MRU (salvo fixada)
		//      e volta uma rota. Só dispara quando o Esc está livre — foco no editor ou em nada; um campo
		//      de formulário (renomear, novo arquivo, título) ou um popover trata o próprio Esc.
		// O Esc que FECHA o overlay do switcher não chega aqui: aquele listener é em capture e faz
		// stopPropagation enquanto o overlay está aberto.
		useEffect(() => {
			async function onKey(event: KeyboardEvent) {
				if (event.key !== "Escape") return;

				if (reading) {
					onExitReading();
					return;
				}

				const active = document.activeElement;
				const escFree =
					!active || active === document.body || Boolean(active.closest(".cm-editor"));
				if (!escFree) return;

				event.preventDefault();
				await flush();
				const store = useDocSessionsStore.getState();
				const session = store.recents.find((entry) => entry.key === sessionKey);
				if (!session?.pinned) {
					store.removeRecent(sessionKey);
				}
				onExit();
			}
			window.addEventListener("keydown", onKey);
			return () => window.removeEventListener("keydown", onKey);
		}, [reading, onExitReading, onExit, flush, sessionKey]);

		useImperativeHandle(ref, () => ({
			flush,
			getContent: () => editorRef.current?.getContent() ?? "",
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

		// Gutters laterais que crescem (flex-1) e ocupam exatamente o vão dos dois lados da coluna de
		// texto. Clicar neles tira o foco do editor — com o editor sem foco, o live preview esconde os
		// marcadores e o markdown fica "limpo". `onMouseDown` (não `onClick`) pra agir antes do foco e
		// `preventDefault` pra não roubar/mexer no foco/seleção.
		function blurOnGutter(event: React.MouseEvent) {
			event.preventDefault();
			editorRef.current?.blur();
		}

		return (
			<div className="relative flex min-h-0 flex-1 flex-col">
				<main
					className={cn(
						"mx-auto flex w-full flex-1 flex-col gap-4 overflow-y-auto",
						reading
							? "max-w-4xl px-6 py-10 lg:max-w-5xl lg:px-10 2xl:max-w-6xl"
							: "max-w-4xl px-4 pt-6 pb-6 lg:max-w-4xl lg:pt-6 lg:pr-6 lg:pl-4 xl:max-w-6xl",
					)}
					style={reading ? { paddingBottom: "calc(2.5rem + var(--prompt-bar-h, 0px))" } : undefined}
				>
					{fileName ? (
						<MarkdownEditor
							key={fileName}
							ref={editorRef}
							initialContent={content}
							fontSize={reading ? "1.25rem" : "1rem"}
							proseMaxWidth={reading ? undefined : "44rem"}
							initialAnchor={initialAnchor}
							onAnchorChange={saveAnchor}
							onChange={(next) => schedule({ name: fileName, content: next })}
							onInlineCodeClick={(text) => void handleInlineCodeCopy(text)}
							onHeadingMention={(text) => usePromptBarStore.getState().appendMention(text)}
							onPasteFrontmatter={onPasteFrontmatter}
						/>
					) : (
						<Text size="sm" tone="muted">
							{emptyState ?? "Nenhum arquivo markdown."}
						</Text>
					)}
				</main>

				{/* Gutters laterais SOBRE os vãos fora da coluna de texto (largura = metade da janela
					    menos metade do max-width da coluna, por breakpoint). `main` mantém a largura
					    responsiva original; estes divs só cobrem o espaço que não era usado e desfocam. */}
				{/** biome-ignore lint/a11y/noStaticElementInteractions: gutter decorativo só pra desfocar. */}
				<div
					aria-hidden
					onMouseDown={blurOnGutter}
					className={cn(
						"absolute inset-y-0 left-0 z-10 hidden cursor-text lg:block",
						reading
							? "w-[max(0px,calc(50%_-_28rem))] lg:w-[max(0px,calc(50%_-_32rem))] 2xl:w-[max(0px,calc(50%_-_36rem))]"
							: "w-[max(0px,calc(50%_-_28rem))] xl:w-[max(0px,calc(50%_-_36rem))]",
					)}
				/>
				{/** biome-ignore lint/a11y/noStaticElementInteractions: gutter decorativo só pra desfocar. */}
				<div
					aria-hidden
					onMouseDown={blurOnGutter}
					className={cn(
						"absolute inset-y-0 right-0 z-10 hidden cursor-text lg:block",
						reading
							? "w-[max(0px,calc(50%_-_28rem))] lg:w-[max(0px,calc(50%_-_32rem))] 2xl:w-[max(0px,calc(50%_-_36rem))]"
							: "w-[max(0px,calc(50%_-_28rem))] xl:w-[max(0px,calc(50%_-_36rem))]",
					)}
				/>
			</div>
		);
	},
);
