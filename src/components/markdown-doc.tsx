import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import {
	HighlightStyle,
	LanguageDescription,
	syntaxHighlighting,
	syntaxTree,
} from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { EditorSelection, Prec } from "@codemirror/state";
import { type Command, EditorView, keymap, placeholder } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { tags as t } from "@lezer/highlight";
import type { DelimiterType, MarkdownConfig } from "@lezer/markdown";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

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
	// Tokens de código nas fences (```js, ```python…). Paleta `oklch` afinada às hues do tema
	// (earthy/terminal): verde oliva, âmbar e vermelho terroso, em lightness alta pra ler sobre
	// o fundo escuro do bloco. Cada tom mapeia um papel semântico do token.
	// Palavras-chave / controle de fluxo → vermelho terroso (mesma hue do destructive).
	{
		tag: [t.keyword, t.moduleKeyword, t.operatorKeyword, t.controlKeyword],
		color: "oklch(0.7 0.12 25)",
	},
	// Strings → verde oliva (hue do primary), o "conteúdo literal" do tema.
	{ tag: [t.string, t.special(t.string), t.regexp], color: "oklch(0.74 0.11 130)" },
	// Números, booleanos e átomos → âmbar (hue do warning).
	{ tag: [t.number, t.bool, t.null, t.atom], color: "oklch(0.78 0.11 70)" },
	// Comentários → cinza apagado do tema, em itálico.
	{
		tag: [t.comment, t.lineComment, t.blockComment],
		color: "var(--muted-foreground)",
		fontStyle: "italic",
	},
	// Variáveis e propriedades → texto base.
	{ tag: [t.variableName, t.propertyName], color: "var(--foreground)" },
	// Funções → ciano dessaturado, único tom frio pra destacar a chamada sem brigar com o verde.
	{ tag: [t.function(t.variableName), t.function(t.propertyName)], color: "oklch(0.78 0.08 210)" },
	// Tipos, classes e namespaces → teal esverdeado.
	{ tag: [t.typeName, t.className, t.namespace], color: "oklch(0.8 0.09 175)" },
	// Tags HTML/JSX e colchetes angulares → verde oliva, como as strings.
	{ tag: [t.tagName, t.angleBracket], color: "oklch(0.74 0.11 130)" },
	// Atributos → âmbar, igual aos valores literais.
	{ tag: [t.attributeName], color: "oklch(0.78 0.11 70)" },
	// Operadores e pontuação → texto base levemente apagado.
	{
		tag: [t.operator, t.punctuation, t.separator, t.derefOperator],
		color: "var(--muted-foreground)",
	},
]);

const createEditorTheme = (fontSize: string) =>
	EditorView.theme(
		{
			"&": {
				backgroundColor: "transparent",
				color: "var(--foreground)",
				fontSize,
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

// `==texto==` não faz parte do CommonMark. Espelha o Strikethrough do GFM: um delimitador
// `==` simétrico que o parser casa e envolve num nó Highlight, com os `==` virando HighlightMark
// (escondidos no live preview). Vira um nó de verdade pra `markdownLivePreview` poder estilizar
// o miolo e sumir com os marcadores quando o cursor sai da linha, igual a *bold*/_italic_.
const highlightDelimiter: DelimiterType = { resolve: "Highlight", mark: "HighlightMark" };

// Apelidos amigáveis pro info string da fence (```react) que não batem direto com os nomes do
// `@codemirror/language-data`. O resto resolve por nome/alias/extensão via matchLanguageName.
const languageAliases: Record<string, string> = {
	react: "jsx",
	"react-ts": "tsx",
	js: "javascript",
	ts: "typescript",
	py: "python",
	sh: "shell",
	bash: "shell",
	zsh: "shell",
	yml: "yaml",
	golang: "go",
	// Django não tem parser próprio no language-data; templates Django usam a mesma sintaxe de
	// Jinja (`{% %}` / `{{ }}`), então reaproveitamos esse modo.
	django: "jinja",
};

// Carrega o parser da linguagem declarada na fence (```js, ```python, ```go…) pro CodeMirror
// aplicar a sintaxe dentro do bloco. Retorna null quando não reconhece (fica texto puro).
function resolveCodeLanguage(info: string) {
	const name = languageAliases[info.toLowerCase()] ?? info;
	return LanguageDescription.matchLanguageName(languages, name, true);
}

const highlightExtension: MarkdownConfig = {
	defineNodes: [{ name: "Highlight" }, { name: "HighlightMark" }],
	parseInline: [
		{
			name: "Highlight",
			parse(cx, next, pos) {
				// 61 = código de "="; precisa de `==` para abrir/fechar a grifa.
				if (next !== 61 || cx.char(pos + 1) !== 61) return -1;
				return cx.addDelimiter(highlightDelimiter, pos, pos + 2, true, true);
			},
		},
	],
};

// Toggle de estilo "de nó": como os marcadores (`**`, `_`, `~~`, `==`) ficam escondidos no
// preview, a remoção não pode depender da borda da seleção. Com o cursor em qualquer ponto de
// um trecho já estilizado, reusar o comando tira o estilo; com seleção fora de um, envolve; sem
// nada ao redor, abre o par e deixa o cursor no meio pra já começar a digitar dentro do estilo.
function toggleStyle(nodeName: string, marker: string): Command {
	const len = marker.length;
	return (view) => {
		const { state } = view;
		const tree = syntaxTree(state);
		const tr = state.changeByRange((range) => {
			let target: SyntaxNode | null = null;
			for (
				let node: SyntaxNode | null = tree.resolveInner(range.from, 1);
				node;
				node = node.parent
			) {
				if (node.name === nodeName) {
					target = node;
					break;
				}
			}

			if (target) {
				// Remove os marcadores das pontas; a seleção reacompanha o deslocamento do início.
				const { from, to } = target;
				const mapPos = (pos: number) => {
					if (pos <= from + len) return from;
					if (pos >= to - len) return to - 2 * len;
					return pos - len;
				};
				return {
					changes: [
						{ from, to: from + len },
						{ from: to - len, to },
					],
					range: EditorSelection.range(mapPos(range.from), mapPos(range.to)),
				};
			}

			return {
				changes: [
					{ from: range.from, insert: marker },
					{ from: range.to, insert: marker },
				],
				range: EditorSelection.range(range.from + len, range.to + len),
			};
		});
		view.dispatch(state.update(tr, { scrollIntoView: true, userEvent: "input.format" }));
		return true;
	};
}

// Atalhos de formatação estilo editor de texto. `Prec.high` pra vencer qualquer binding padrão.
const formattingKeymap = Prec.high(
	keymap.of([
		{ key: "Mod-b", run: toggleStyle("StrongEmphasis", "**"), preventDefault: true },
		{ key: "Mod-i", run: toggleStyle("Emphasis", "_"), preventDefault: true },
		{ key: "Mod-h", run: toggleStyle("Highlight", "=="), preventDefault: true },
		{ key: "Mod-Shift-s", run: toggleStyle("Strikethrough", "~~"), preventDefault: true },
	]),
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
	blur: () => void;
};

type MarkdownEditorProps = {
	initialContent: string;
	onChange: (content: string) => void;
	onInlineCodeClick?: (text: string) => void;
	onHeadingMention?: (text: string) => void;
	// Tamanho base da fonte; títulos e demais elementos usam `em`, então escalam junto.
	fontSize?: string;
};

// Editor markdown sempre editável com live preview estilo Obsidian: o `.md` cru fica
// intacto no disco, mas headings, *bold*, _italic_, etc. são estilizados ao vivo e os
// marcadores de sintaxe somem quando o cursor sai da linha.
export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
	function MarkdownEditor(
		{ initialContent, onChange, onInlineCodeClick, onHeadingMention, fontSize = "1rem" },
		ref,
	) {
		const [draft, setDraft] = useState(initialContent);
		const cmRef = useRef<ReactCodeMirrorRef>(null);

		// Tira o foco do editor quando o clique não cai sobre o TEXTO renderizado, deixando o markdown
		// "limpo" (o live preview esconde os marcadores ao perder o foco). As linhas ocupam a largura
		// toda, então o vão lateral é parte do editor e focaria normalmente. Em vez de heurística,
		// medimos os retângulos reais dos glifos da linha clicada via `Range.getClientRects()` (cobre
		// linhas quebradas e os dois lados) e checamos se o ponto caiu sobre algum. Cliques fora do
		// editor (toolbar, descrição, margens da página) também desfocam. Captura no documento porque
		// o alvo pode estar fora do DOM do CodeMirror.
		useEffect(() => {
			function pointOverText(el: Element, x: number, y: number) {
				const range = document.createRange();
				range.selectNodeContents(el);
				for (const rect of Array.from(range.getClientRects())) {
					if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
						return true;
					}
				}
				return false;
			}

			// Impede o CodeMirror de receber o mousedown (ele foca o editor no próprio handler, o que
			// desfaria o blur) e cancela o foco nativo do contenteditable, depois tira o foco.
			function blur(event: MouseEvent, view: EditorView) {
				event.preventDefault();
				event.stopPropagation();
				view.contentDOM.blur();
			}

			function onMouseDown(event: MouseEvent) {
				if (event.button !== 0) return;
				const view = cmRef.current?.view;
				if (!view) return;

				const target = event.target as HTMLElement;
				if (!view.dom.contains(target)) {
					if (view.hasFocus) view.contentDOM.blur();
					return;
				}

				// Clicou diretamente numa linha: mantém o foco só se o ponto estiver sobre os glifos;
				// no vão lateral (ou linha vazia) desfoca.
				if (target.classList.contains("cm-line")) {
					if (!pointOverText(target, event.clientX, event.clientY)) blur(event, view);
					return;
				}

				// Área estrutural sem texto (padding do conteúdo, scroller abaixo das linhas) → desfoca.
				if (target.classList.contains("cm-content") || target.classList.contains("cm-scroller")) {
					blur(event, view);
				}

				// Qualquer outro alvo (spans de estilo, widgets, links, código inline) tem comportamento
				// próprio e mantém o foco.
			}

			document.addEventListener("mousedown", onMouseDown, true);
			return () => document.removeEventListener("mousedown", onMouseDown, true);
		}, []);

		const extensions = useMemo(
			() => [
				markdown({
					base: markdownLanguage,
					extensions: [highlightExtension],
					codeLanguages: resolveCodeLanguage,
				}),
				syntaxHighlighting(highlightStyle),
				markdownLivePreview({ onInlineCodeClick, onHeadingMention }),
				formattingKeymap,
				createEditorTheme(fontSize),
				EditorView.lineWrapping,
				placeholder("Comece a escrever…"),
			],
			[onInlineCodeClick, onHeadingMention, fontSize],
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
			blur() {
				cmRef.current?.view?.contentDOM.blur();
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
