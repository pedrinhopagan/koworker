import { highlightTree } from "@lezer/highlight";
import type { SyntaxNode, Tree } from "@lezer/common";
import {
	createElement,
	Fragment,
	memo,
	type ReactNode,
	useMemo,
	type MouseEvent,
	useSyncExternalStore,
} from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { useLinkCwd } from "@/components/link-cwd";
import {
	codeLanguageVersion,
	loadedCodeLanguage,
	markdownHighlightStyle,
	markdownParser,
	mountMarkdownHighlightStyle,
	subscribeCodeLanguages,
} from "@/lib/markdown-engine";
import { cn } from "@/lib/utils";
import { fileHref, openLinkTarget } from "@/lib/link-navigation";

// As classes que o `highlightTree` devolve precisam existir no documento; dentro do editor quem as
// monta é o `syntaxHighlighting`, aqui é esta chamada — idempotente e feita uma vez por bundle.
mountMarkdownHighlightStyle();

// Leitura estática do mesmo markdown que o editor mostra. O parser, as cores de sintaxe e as
// classes visuais vêm de `@/lib/markdown-engine` + `src/styles/markdown.css`, os mesmos que o
// leitor de `.md` usa — aqui só trocamos o hospedeiro: em vez do DOM linha-a-linha do CodeMirror,
// elementos de verdade (h1, ul, blockquote, table), porque a conversa de um agent tem dezenas de
// falas e montar um editor por fala custaria um editor por fala.

// Marcadores de sintaxe: existem no texto cru, mas não no texto lido.
const SYNTAX_MARKS = new Set([
	"HeaderMark",
	"QuoteMark",
	"ListMark",
	"EmphasisMark",
	"StrikethroughMark",
	"HighlightMark",
	"CodeMark",
	"CodeInfo",
	"LinkMark",
	"LinkTitle",
	"TableDelimiter",
	"TaskMarker",
	"CommentBlock",
	"ProcessingInstructionBlock",
	"HTMLTag",
	"HTMLBlock",
]);

// Marcadores que carregam o espaço que os separa do conteúdo (`## `, `- `, `> `, `[x] `). Escondido
// o marcador, o espaço vira recuo fantasma no começo do texto — some junto.
const SPACED_MARKS = new Set(["HeaderMark", "ListMark", "QuoteMark", "TaskMarker"]);

const HEADING_LEVEL: Record<string, number> = {
	ATXHeading1: 1,
	ATXHeading2: 2,
	ATXHeading3: 3,
	ATXHeading4: 4,
	ATXHeading5: 5,
	ATXHeading6: 6,
	SetextHeading1: 1,
	SetextHeading2: 2,
};

function textOf(doc: string, node: SyntaxNode) {
	return doc.slice(node.from, node.to);
}

// O `href` só sai daqui como `http(s)`, `mailto` ou caminho relativo: markdown de agent é conteúdo
// de terceiro, e `javascript:` num link clicável seria execução arbitrária dentro do app.
function safeHref(raw: string) {
	const url = raw.trim().replaceAll(/^<|>$/g, "");
	if (url.startsWith("/")) {
		return fileHref(url);
	}
	return /^(https?:|mailto:|file:|#|\.)/i.test(url) ? url : null;
}

function childUrl(doc: string, node: SyntaxNode) {
	for (let child = node.firstChild; child; child = child.nextSibling) {
		if (child.name === "URL") {
			return safeHref(textOf(doc, child));
		}
	}

	return null;
}

// Texto do nó ignorando os marcadores de sintaxe — serve de `alt` de imagem e de rótulo de link
// sem precisar renderizar os filhos como elementos.
function plainText(doc: string, node: SyntaxNode): string {
	let out = "";
	let pos = node.from;

	for (let child = node.firstChild; child; child = child.nextSibling) {
		out += doc.slice(pos, child.from);
		if (!SYNTAX_MARKS.has(child.name) && child.name !== "URL") {
			out += plainText(doc, child);
		}
		pos = child.to;
	}

	return out + doc.slice(pos, node.to);
}

function renderCode(code: string, info: string): ReactNode {
	const support = info ? loadedCodeLanguage(info) : null;
	if (!support) {
		return code;
	}

	const tree = support.language.parser.parse(code);
	const out: ReactNode[] = [];
	let pos = 0;

	highlightTree(tree, markdownHighlightStyle, (from, to, classes) => {
		if (from > pos) {
			out.push(code.slice(pos, from));
		}
		out.push(
			<span key={from} className={classes}>
				{code.slice(from, to)}
			</span>,
		);
		pos = to;
	});

	if (pos < code.length) {
		out.push(code.slice(pos));
	}

	return out;
}

function renderInline(doc: string, node: SyntaxNode): ReactNode[] {
	const out: ReactNode[] = [];
	let pos = node.from;
	let afterSpacedMark = false;

	function push(text: string) {
		const trimmed = afterSpacedMark ? text.replace(/^[ \t]+/, "") : text;
		afterSpacedMark = false;
		if (trimmed) {
			out.push(trimmed);
		}
	}

	for (let child = node.firstChild; child; child = child.nextSibling) {
		push(doc.slice(pos, child.from));
		pos = child.to;
		afterSpacedMark = SPACED_MARKS.has(child.name);

		const key = `${child.from}-${child.name}`;

		if (SYNTAX_MARKS.has(child.name) || child.name === "URL") {
			continue;
		}

		if (child.name === "Escape") {
			push(textOf(doc, child).slice(1));
			continue;
		}

		if (child.name === "HardBreak") {
			out.push(<br key={key} />);
			continue;
		}

		if (child.name === "InlineCode") {
			out.push(
				<code key={key} className="cm-md-inline-code">
					{plainText(doc, child)}
				</code>,
			);
			continue;
		}

		if (child.name === "StrongEmphasis") {
			out.push(<strong key={key}>{renderInline(doc, child)}</strong>);
			continue;
		}

		if (child.name === "Emphasis") {
			out.push(<em key={key}>{renderInline(doc, child)}</em>);
			continue;
		}

		if (child.name === "Strikethrough") {
			out.push(<del key={key}>{renderInline(doc, child)}</del>);
			continue;
		}

		if (child.name === "Highlight") {
			out.push(
				<mark key={key} className="cm-md-highlight">
					{renderInline(doc, child)}
				</mark>,
			);
			continue;
		}

		if (child.name === "Image") {
			const src = childUrl(doc, child);
			out.push(
				src ? (
					<img key={key} src={src} alt={plainText(doc, child)} loading="lazy" />
				) : (
					<Fragment key={key}>{plainText(doc, child)}</Fragment>
				),
			);
			continue;
		}

		if (child.name === "Link" || child.name === "Autolink" || child.name === "URLNode") {
			const href = childUrl(doc, child) ?? safeHref(plainText(doc, child));
			out.push(
				href ? (
					<a key={key} href={href} target="_blank" rel="noreferrer noopener">
						{renderInline(doc, child)}
					</a>
				) : (
					<Fragment key={key}>{renderInline(doc, child)}</Fragment>
				),
			);
			continue;
		}

		out.push(<Fragment key={key}>{renderInline(doc, child)}</Fragment>);
	}

	push(doc.slice(pos, node.to));

	return out;
}

function renderTable(doc: string, node: SyntaxNode, key: string) {
	const header: SyntaxNode[] = [];
	const rows: SyntaxNode[][] = [];

	for (let row = node.firstChild; row; row = row.nextSibling) {
		if (row.name !== "TableHeader" && row.name !== "TableRow") {
			continue;
		}

		const cells: SyntaxNode[] = [];
		for (let cell = row.firstChild; cell; cell = cell.nextSibling) {
			if (cell.name === "TableCell") {
				cells.push(cell);
			}
		}

		if (row.name === "TableHeader") {
			header.push(...cells);
		} else {
			rows.push(cells);
		}
	}

	return (
		<div key={key} className="cm-md-table-wrapper">
			<table className="cm-md-table">
				{header.length > 0 && (
					<thead>
						<tr>
							{header.map((cell) => (
								<th key={cell.from}>{renderInline(doc, cell)}</th>
							))}
						</tr>
					</thead>
				)}
				<tbody>
					{rows.map((cells, index) => (
						<tr key={cells[0]?.from ?? index}>
							{cells.map((cell) => (
								<td key={cell.from}>{renderInline(doc, cell)}</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function renderListItem(doc: string, node: SyntaxNode) {
	const task = node.getChild("Task");
	const marker = task?.getChild("TaskMarker");
	const checked = marker ? /[xX]/.test(textOf(doc, marker)) : false;

	return (
		<li key={node.from} className={cn(task && "md-view-task")}>
			{task && (
				<span className="cm-md-task-checkbox">
					<Checkbox
						checked={checked}
						size="em"
						tabIndex={-1}
						aria-readonly
						className="pointer-events-none"
					/>
				</span>
			)}
			{renderBlocks(doc, task ?? node, task ? "inline" : "block")}
		</li>
	);
}

// `mode: "inline"` é o item de tarefa: o conteúdo do `Task` é inline puro e envolvê-lo num `<p>`
// jogaria o texto para baixo do checkbox.
function renderBlocks(doc: string, parent: SyntaxNode, mode: "block" | "inline" = "block") {
	if (mode === "inline") {
		return renderInline(doc, parent);
	}

	const out: ReactNode[] = [];

	for (let node = parent.firstChild; node; node = node.nextSibling) {
		const key = `${node.from}-${node.name}`;
		const level = HEADING_LEVEL[node.name];

		if (level) {
			out.push(
				createElement(
					`h${level}`,
					{ key, className: `cm-md-heading cm-md-h${level}` },
					renderInline(doc, node),
				),
			);
			continue;
		}

		if (node.name === "Paragraph") {
			out.push(<p key={key}>{renderInline(doc, node)}</p>);
			continue;
		}

		if (node.name === "HorizontalRule") {
			out.push(<hr key={key} className="cm-md-divider" />);
			continue;
		}

		if (node.name === "FencedCode" || node.name === "CodeBlock") {
			const infoNode = node.getChild("CodeInfo");
			const textNode = node.getChild("CodeText");
			const code = textNode ? textOf(doc, textNode) : "";
			out.push(
				<pre key={key} className="cm-md-code-block cm-md-code-block-first cm-md-code-block-last">
					<code>{renderCode(code, infoNode ? textOf(doc, infoNode).trim() : "")}</code>
				</pre>,
			);
			continue;
		}

		if (node.name === "Blockquote") {
			out.push(
				<blockquote key={key} className="cm-md-blockquote">
					{renderBlocks(doc, node)}
				</blockquote>,
			);
			continue;
		}

		if (node.name === "BulletList" || node.name === "OrderedList") {
			const items: ReactNode[] = [];
			for (let item = node.firstChild; item; item = item.nextSibling) {
				if (item.name === "ListItem") {
					items.push(renderListItem(doc, item));
				}
			}
			out.push(
				node.name === "BulletList" ? <ul key={key}>{items}</ul> : <ol key={key}>{items}</ol>,
			);
			continue;
		}

		if (node.name === "Table") {
			out.push(renderTable(doc, node, key));
			continue;
		}

		if (SYNTAX_MARKS.has(node.name)) {
			continue;
		}

		out.push(<p key={key}>{renderInline(doc, node)}</p>);
	}

	return out;
}

function renderDocument(text: string, tree: Tree) {
	return renderBlocks(text, tree.topNode);
}

// O parser de uma fence (```go) chega assíncrono. Quem estiver na tela redesenha quando chegar, e
// o bloco sai de texto puro para código colorido sem que ninguém precise recarregar a página.
function useCodeLanguages() {
	return useSyncExternalStore(subscribeCodeLanguages, codeLanguageVersion, codeLanguageVersion);
}

export const MarkdownView = memo(function MarkdownView({
	text,
	className,
}: {
	text: string;
	className?: string;
}) {
	const cwd = useLinkCwd();
	const languages = useCodeLanguages();
	const content = useMemo(
		() => renderDocument(text, markdownParser.parse(text)),
		// `languages` entra de propósito: uma linguagem que acabou de carregar precisa de um reparse.
		// oxlint-disable-next-line exhaustive-deps
		[text, languages],
	);

	function handleClick(event: MouseEvent<HTMLDivElement>) {
		const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
		if (!link) {
			return;
		}
		const raw = link.getAttribute("href") ?? "";
		const filesystemLink = link.href.startsWith("file://") || (cwd && raw.startsWith("."));
		if (!filesystemLink) return;

		event.preventDefault();
		void openLinkTarget(raw, cwd);
	}

	return (
		<div
			data-component="markdown-view"
			className={cn("md-view min-w-0", className)}
			onClick={handleClick}
		>
			{content}
		</div>
	);
});
