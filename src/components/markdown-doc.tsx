import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
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
		"&": {
			backgroundColor: "transparent",
			color: "var(--foreground)",
			fontSize: "0.95rem",
			fontFamily: "var(--font-reading)",
		},
		"&.cm-focused": { outline: "none" },
		".cm-content": {
			fontFamily: "inherit",
			lineHeight: "1.7",
			padding: "0",
			caretColor: "var(--foreground)",
		},
		".cm-line": { padding: "0" },
		".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--foreground)" },
		"&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
			backgroundColor: "color-mix(in oklab, var(--primary) 28%, transparent)",
		},
		".cm-scroller": { fontFamily: "inherit" },
	},
	{ dark: true },
);

const extensions = [
	markdown({ base: markdownLanguage }),
	syntaxHighlighting(highlightStyle),
	markdownLivePreview,
	editorTheme,
	EditorView.lineWrapping,
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
