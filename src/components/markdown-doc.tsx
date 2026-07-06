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
import {
	anchorAtLine,
	type HeadingAnchor,
	lineForAnchor,
	offsetOfLine,
} from "@/lib/heading-anchor";
import { extractFrontmatter } from "@/lib/skills/parser";

// Lê o ponto de leitura atual a partir do scroll do CodeMirror e o traduz em âncora resiliente
// (heading + offset). A matemática de heading mora no lib; aqui só tocamos o `view`.
function captureAnchor(view: EditorView): HeadingAnchor {
	const scrollTop = view.scrollDOM.scrollTop;
	const topBlock = view.lineBlockAtHeight(scrollTop);
	const topLine = view.state.doc.lineAt(topBlock.from).number;
	const doc = view.state.doc.toString();

	const at = anchorAtLine(doc, topLine);
	if (!at) {
		return { headingText: null, level: 0, occurrence: 0, offsetPx: scrollTop };
	}

	const headingTop = view.lineBlockAt(view.state.doc.line(at.headingLine).from).top;
	return {
		headingText: at.headingText,
		level: at.level,
		occurrence: at.occurrence,
		offsetPx: scrollTop - headingTop,
	};
}

// Posiciona o scroll na âncora salva. Roda em `requestMeasure` (depois do layout) pra vencer o
// scroll-pro-fim que o `selection` inicial provoca — ver landmine #1 do plano.
function restoreAnchor(view: EditorView, anchor: HeadingAnchor) {
	if (anchor.headingText === null) {
		view.requestMeasure({
			read: () => 0,
			write: () => {
				view.scrollDOM.scrollTop = anchor.offsetPx;
			},
		});
		return;
	}

	const line = lineForAnchor(view.state.doc.toString(), anchor);
	if (line === null) {
		return;
	}

	const from = view.state.doc.line(line).from;
	view.requestMeasure({
		read: () => view.lineBlockAt(from).top,
		write: (top) => {
			view.scrollDOM.scrollTop = top + anchor.offsetPx;
		},
	});
}

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

const createEditorTheme = (fontSize: string, proseMaxWidth?: string) =>
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
			// As linhas de texto ficam numa medida de leitura confortável e centralizada; tabelas e
			// outros block widgets não são `.cm-line`, então seguem usando a largura cheia do editor.
			".cm-line": {
				padding: "0",
				...(proseMaxWidth ? { maxWidth: proseMaxWidth, marginInline: "auto" } : {}),
			},
			".cm-cursor, .cm-dropCursor": {
				borderLeftColor: "var(--primary)",
				borderLeftWidth: "2px",
				boxShadow: "0 0 6px -1px var(--primary)",
			},
			// Seleção neutra derivada do foreground (não do --primary, que pode ser um preset verde):
			// realce cinza legível, alinhado à regra global de ::selection.
			"&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
				backgroundColor: "color-mix(in oklab, var(--foreground) 22%, transparent)",
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
	// Largura-limite da prosa: restringe `.cm-line` a uma medida de leitura e centraliza. Tabelas
	// (block widgets) ignoram o limite e usam a largura cheia do editor. Sem valor, prosa livre.
	proseMaxWidth?: string;
	// Ponto de leitura salvo deste documento: ao montar, restaura o scroll para essa âncora.
	initialAnchor?: HeadingAnchor | null;
	// Captura debounced do ponto de leitura ao rolar (e na desmontagem) — alimenta a memória.
	onAnchorChange?: (anchor: HeadingAnchor) => void;
	// Colar markdown com frontmatter (`---...---`) roteia os metadados pra fora do editor (controles
	// + descrição da página) e insere só o corpo. Sem callback, o paste segue cru e nativo.
	onPasteFrontmatter?: (frontmatter: Record<string, unknown>, body: string) => void;
};

// Editor markdown sempre editável com live preview estilo Obsidian: o `.md` cru fica
// intacto no disco, mas headings, *bold*, _italic_, etc. são estilizados ao vivo e os
// marcadores de sintaxe somem quando o cursor sai da linha.
export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
	function MarkdownEditor(
		{
			initialContent,
			onChange,
			onInlineCodeClick,
			onHeadingMention,
			fontSize = "1rem",
			proseMaxWidth,
			initialAnchor,
			onAnchorChange,
			onPasteFrontmatter,
		},
		ref,
	) {
		const [draft, setDraft] = useState(initialContent);
		const cmRef = useRef<ReactCodeMirrorRef>(null);
		// View vinda do `onCreateEditor` (garantida no momento da criação). O `cmRef.current.view`
		// só é populado num commit posterior, então é tarde demais pra um efeito de mount.
		const [view, setView] = useState<EditorView | null>(null);

		// Posição da seleção inicial: na âncora salva quando há uma resolvível, senão no fim do
		// conteúdo (comportamento original). Pôr a seleção na linha-alvo faz o scroll-to-selection
		// nativo do CM concordar com o restore, em vez de brigar com ele (landmine #1).
		const [initialSelection] = useState(() => {
			if (!initialAnchor) {
				return initialContent.length;
			}
			if (initialAnchor.headingText === null) {
				return 0;
			}
			const line = lineForAnchor(initialContent, initialAnchor);
			return line === null ? initialContent.length : offsetOfLine(initialContent, line);
		});

		// Refs que guardam os callbacks mais recentes sem invalidar o useMemo de extensions.
		// Sem isso, cada re-render do pai (ex: digitação no prompt) cria novas referências,
		// o CodeMirror reconfgura e todos os marks aparecem por um frame.
		const onInlineCodeClickRef = useRef(onInlineCodeClick);
		const onHeadingMentionRef = useRef(onHeadingMention);
		const onAnchorChangeRef = useRef(onAnchorChange);
		const onPasteFrontmatterRef = useRef(onPasteFrontmatter);
		useEffect(() => {
			onInlineCodeClickRef.current = onInlineCodeClick;
			onHeadingMentionRef.current = onHeadingMention;
			onAnchorChangeRef.current = onAnchorChange;
			onPasteFrontmatterRef.current = onPasteFrontmatter;
		});

		// Captura do ponto de leitura: listener de scroll com debounce, mais uma captura final na
		// desmontagem (troca de arquivo/saída da página). Lê o `view` direto — o store fica sempre
		// fresco sem depender de ler o handle no unmount (quando o ref já pode estar nulo).
		useEffect(() => {
			if (!view) return;

			const scroller = view.scrollDOM;
			let timer: ReturnType<typeof setTimeout> | null = null;
			const emit = () => onAnchorChangeRef.current?.(captureAnchor(view));
			const onScroll = () => {
				if (timer) clearTimeout(timer);
				timer = setTimeout(emit, 200);
			};

			scroller.addEventListener("scroll", onScroll, { passive: true });
			return () => {
				scroller.removeEventListener("scroll", onScroll);
				if (timer) clearTimeout(timer);
				emit();
			};
		}, [view]);

		// Qualquer clique DENTRO do DOM do editor foca o texto (o CodeMirror cuida disso sozinho), mesmo
		// em linha vazia ou no vão lateral da linha. Cliques FORA (toolbar, descrição, gutters da página)
		// tiram o foco, deixando o markdown "limpo" porque o live preview esconde os marcadores ao perder
		// o foco. Captura no documento porque o alvo pode estar fora do DOM do CodeMirror.
		useEffect(() => {
			function onMouseDown(event: MouseEvent) {
				if (event.button !== 0) return;
				const view = cmRef.current?.view;
				if (!view) return;

				const target = event.target as HTMLElement;
				if (!view.dom.contains(target) && view.hasFocus) view.contentDOM.blur();
			}

			document.addEventListener("mousedown", onMouseDown, true);
			return () => document.removeEventListener("mousedown", onMouseDown, true);
		}, []);

		const stableCallbacks = useMemo(
			() => ({
				onInlineCodeClick: (text: string) => onInlineCodeClickRef.current?.(text),
				onHeadingMention: (text: string) => onHeadingMentionRef.current?.(text),
			}),
			[],
		);

		// Paste com frontmatter: lê o callback pelo ref pra extensão ficar estável e não entrar nas
		// deps do useMemo (mesmo motivo do padrão dos outros refs). Sem callback ou sem frontmatter,
		// devolve falso e o paste nativo segue cru — vault/tarefas não passam o callback.
		const pasteHandler = useMemo(
			() =>
				EditorView.domEventHandlers({
					paste(event, view) {
						const route = onPasteFrontmatterRef.current;
						if (!route) return false;

						const text = event.clipboardData?.getData("text/plain");
						if (!text) return false;

						const extracted = extractFrontmatter(text);
						if (!extracted) return false;

						event.preventDefault();
						view.dispatch({
							...view.state.replaceSelection(extracted.body),
							userEvent: "input.paste",
						});
						route(extracted.frontmatter, extracted.body);
						return true;
					},
				}),
			[],
		);

		const extensions = useMemo(
			() => [
				pasteHandler,
				markdown({
					base: markdownLanguage,
					extensions: [highlightExtension],
					codeLanguages: resolveCodeLanguage,
				}),
				syntaxHighlighting(highlightStyle),
				markdownLivePreview(stableCallbacks),
				formattingKeymap,
				createEditorTheme(fontSize, proseMaxWidth),
				EditorView.lineWrapping,
				placeholder("Comece a escrever…"),
			],
			[stableCallbacks, fontSize, proseMaxWidth, pasteHandler],
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
				selection={{ anchor: initialSelection }}
				onCreateEditor={(created) => {
					setView(created);
					if (initialAnchor) restoreAnchor(created, initialAnchor);
				}}
				onChange={(value) => {
					setDraft(value);
					onChange(value);
				}}
			/>
		);
	},
);
