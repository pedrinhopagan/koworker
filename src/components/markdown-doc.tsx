import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView, placeholder } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import CodeMirror from "@uiw/react-codemirror";
import { useState } from "react";

import { markdownLivePreview } from "@/components/markdown-live-preview";

const highlightStyle = HighlightStyle.define([
	{ tag: t.strong, fontWeight: "700" },
	{ tag: t.emphasis, fontStyle: "italic" },
	{ tag: t.strikethrough, textDecoration: "line-through" },
	{ tag: t.link, color: "var(--primary)", textDecoration: "underline" },
	{ tag: t.url, color: "var(--muted-foreground)" },
	{ tag: [t.monospace, t.contentSeparator], fontFamily: "var(--font-mono)" },
	{ tag: t.quote, color: "var(--muted-foreground)", fontStyle: "italic" },
	{ tag: t.list, color: "var(--muted-foreground)" },
	{ tag: t.heading, fontWeight: "700" },
]);

const editorTheme = EditorView.theme(
	{
		// Trilho esquerdo sempre presente (transparente em repouso → muted no hover →
		// primary no foco). É a única borda: combina com o caret (também barra vertical
		// primary), lê como prompt de terminal e não causa reflow ao trocar de estado.
		"&": {
			backgroundColor: "transparent",
			color: "var(--foreground)",
			fontSize: "0.95rem",
			fontFamily: "var(--font-reading)",
			borderLeft: "2px solid transparent",
			paddingLeft: "0.875rem",
			transition: "border-color 0.15s ease, background-color 0.15s ease",
		},
		"&:hover:not(.cm-focused)": { borderLeftColor: "var(--border)" },
		"&.cm-focused": {
			outline: "none",
			borderLeftColor: "var(--primary)",
			backgroundColor: "color-mix(in oklab, var(--primary) 4%, transparent)",
		},
		".cm-content": {
			fontFamily: "inherit",
			lineHeight: "1.7",
			padding: "0",
			// Esconde o caret nativo: quem desenha é `.cm-cursor` (barra primary com glow).
			caretColor: "transparent",
		},
		".cm-line": { padding: "0" },
		".cm-cursor, .cm-dropCursor": {
			borderLeftColor: "var(--primary)",
			borderLeftWidth: "2px",
			boxShadow: "0 0 6px -1px var(--primary)",
		},
		"&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
			backgroundColor: "color-mix(in oklab, var(--primary) 28%, transparent)",
		},
		".cm-scroller": { fontFamily: "inherit" },
		".cm-placeholder": { color: "var(--muted-foreground)", fontStyle: "italic" },
	},
	{ dark: true },
);

const extensions = [
	markdown({ base: markdownLanguage }),
	syntaxHighlighting(highlightStyle),
	markdownLivePreview,
	editorTheme,
	EditorView.lineWrapping,
	placeholder("Comece a escrever…"),
];

const basicSetup = {
	lineNumbers: false,
	foldGutter: false,
	highlightActiveLine: false,
	highlightActiveLineGutter: false,
	highlightSelectionMatches: false,
	indentOnInput: false,
};

// Editor markdown sempre editável com live preview estilo Obsidian: o `.md` cru fica
// intacto no disco, mas headings, *bold*, _italic_, etc. são estilizados ao vivo e os
// marcadores de sintaxe somem quando o cursor sai da linha.
export function MarkdownEditor({
	initialContent,
	onChange,
}: {
	initialContent: string;
	onChange: (content: string) => void;
}) {
	const [draft, setDraft] = useState(initialContent);

	return (
		<CodeMirror
			value={draft}
			theme="none"
			// Preenche a altura do pai (que é flex) para que toda a janela seja área
			// clicável: clicar abaixo do texto leva o caret ao fim do doc. Em pais sem
			// altura definida (ex.: preview de fontes), `flex-1` é ignorado e `100%`
			// resolve para `auto`, mantendo o tamanho do conteúdo.
			height="100%"
			className="min-h-0 flex-1"
			basicSetup={basicSetup}
			extensions={extensions}
			// Cursor inicia no fim do doc: assim a primeira linha (o H1/título) não fica
			// "ativa" ao entrar e o marcador `#` aparece já estilizado, sem o cru.
			selection={{ anchor: initialContent.length }}
			onChange={(value) => {
				setDraft(value);
				onChange(value);
			}}
		/>
	);
}
