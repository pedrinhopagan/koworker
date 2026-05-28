import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView, placeholder } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";

import {
	collapseAllHeadings,
	expandAllHeadings,
	markdownLivePreview,
} from "@/components/markdown-live-preview";

const highlightStyle = HighlightStyle.define([
	{ tag: t.strong, fontWeight: "700" },
	{ tag: t.emphasis, fontStyle: "italic" },
	{ tag: t.strikethrough, textDecoration: "line-through" },
	{ tag: t.link, color: "var(--primary)", textDecoration: "underline" },
	{ tag: t.url, color: "var(--muted-foreground)" },
	{ tag: t.contentSeparator, fontFamily: "var(--font-mono)" },
	{ tag: t.quote, color: "var(--muted-foreground)", fontStyle: "italic" },
	{ tag: t.list, color: "var(--muted-foreground)" },
	{ tag: t.heading, fontWeight: "700" },
]);

const editorTheme = EditorView.theme(
	{
		"&": {
			backgroundColor: "transparent",
			color: "var(--foreground)",
			fontSize: "1rem",
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

const basicSetup = {
	lineNumbers: false,
	foldGutter: false,
	highlightActiveLine: false,
	highlightActiveLineGutter: false,
	highlightSelectionMatches: false,
	indentOnInput: false,
};

export type MarkdownEditorHandle = {
	collapseAll: () => void;
	expandAll: () => void;
	getContent: () => string;
};

type MarkdownEditorProps = {
	initialContent: string;
	onChange: (content: string) => void;
	onInlineCodeClick?: (text: string) => void;
	onHeadingMention?: (text: string) => void;
};

// Editor markdown sempre editável com live preview estilo Obsidian: o `.md` cru fica
// intacto no disco, mas headings, *bold*, _italic_, etc. são estilizados ao vivo e os
// marcadores de sintaxe somem quando o cursor sai da linha.
export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
	function MarkdownEditor({ initialContent, onChange, onInlineCodeClick, onHeadingMention }, ref) {
		const [draft, setDraft] = useState(initialContent);
		const cmRef = useRef<ReactCodeMirrorRef>(null);

		const extensions = useMemo(
			() => [
				markdown({ base: markdownLanguage }),
				syntaxHighlighting(highlightStyle),
				markdownLivePreview({ onInlineCodeClick, onHeadingMention }),
				editorTheme,
				EditorView.lineWrapping,
				placeholder("Comece a escrever…"),
			],
			[onInlineCodeClick, onHeadingMention],
		);

		useImperativeHandle(ref, () => ({
			collapseAll() {
				cmRef.current?.view?.dispatch({ effects: collapseAllHeadings.of() });
			},
			expandAll() {
				cmRef.current?.view?.dispatch({ effects: expandAllHeadings.of() });
			},
			getContent() {
				return cmRef.current?.view?.state.doc.toString() ?? draft;
			},
		}));

		return (
			<CodeMirror
				ref={cmRef}
				value={draft}
				theme="none"
				height="100%"
				className="min-h-0 flex-1"
				basicSetup={basicSetup}
				extensions={extensions}
				selection={{ anchor: initialContent.length }}
				onChange={(value) => {
					setDraft(value);
					onChange(value);
				}}
			/>
		);
	},
);
