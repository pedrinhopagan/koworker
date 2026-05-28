// oxlint-disable max-classes-per-file -- vários WidgetType coesos do mesmo plugin CodeMirror
import { syntaxTree } from "@codemirror/language";
import { type Range, StateEffect, StateField } from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	EditorView,
	ViewPlugin,
	type ViewUpdate,
	WidgetType,
} from "@codemirror/view";

// Persistência dos headings recolhidos: guarda as posições (line.from) marcadas
// como collapsed; o conjunto é remapeado nas edições para acompanhar o doc.
const toggleHeadingCollapse = StateEffect.define<number>();
export const collapseAllHeadings = StateEffect.define<void>();
export const expandAllHeadings = StateEffect.define<void>();

const collapsedHeadingsField = StateField.define<Set<number>>({
	create() {
		return new Set();
	},
	update(value, tr) {
		let next = value;
		if (tr.docChanged) {
			next = new Set();
			for (const pos of value) {
				next.add(tr.changes.mapPos(pos, -1));
			}
		}
		for (const effect of tr.effects) {
			if (effect.is(toggleHeadingCollapse)) {
				const copy = new Set(next);
				if (copy.has(effect.value)) {
					copy.delete(effect.value);
				} else {
					copy.add(effect.value);
				}
				next = copy;
			}
			if (effect.is(collapseAllHeadings)) {
				const all = new Set<number>();
				const docNow = tr.state.doc;
				// O primeiro H1 fica de fora: ele costuma ser o título do arquivo, e
				// colapsá-lo esconderia o documento inteiro.
				let firstH1Skipped = false;
				syntaxTree(tr.state).iterate({
					enter: (node) => {
						if (!/^ATXHeading[1-6]$/.test(node.name)) return;
						if (!firstH1Skipped && node.name === "ATXHeading1") {
							firstH1Skipped = true;
							return;
						}
						all.add(docNow.lineAt(node.from).from);
					},
				});
				next = all;
			}
			if (effect.is(expandAllHeadings)) {
				next = new Set();
			}
		}
		return next;
	},
});

const hiddenLine = Decoration.line({ class: "cm-md-collapsed" });

// Marcadores de sintaxe que somem quando o cursor não está na linha (estilo "live preview" do Obsidian).
// `ListMark` fica de fora de propósito: esconder `- ` apagaria o marcador da lista.
const HIDDEN_MARKS = new Set([
	"HeaderMark",
	"EmphasisMark",
	"StrikethroughMark",
	"QuoteMark",
	"LinkMark",
	"CodeMark",
	"CodeInfo",
]);

const codeBlockLine = Decoration.line({ class: "cm-md-code-block" });
const codeBlockFirst = Decoration.line({ class: "cm-md-code-block cm-md-code-block-first" });
const codeBlockLast = Decoration.line({ class: "cm-md-code-block cm-md-code-block-last" });

const headingLine: Record<string, Decoration> = {
	ATXHeading1: Decoration.line({ class: "cm-md-h1 cm-md-heading" }),
	ATXHeading2: Decoration.line({ class: "cm-md-h2 cm-md-heading" }),
	ATXHeading3: Decoration.line({ class: "cm-md-h3 cm-md-heading" }),
	ATXHeading4: Decoration.line({ class: "cm-md-h4 cm-md-heading" }),
	ATXHeading5: Decoration.line({ class: "cm-md-h5 cm-md-heading" }),
	ATXHeading6: Decoration.line({ class: "cm-md-h6 cm-md-heading" }),
};

const headingLineCollapsed: Record<string, Decoration> = {
	ATXHeading1: Decoration.line({ class: "cm-md-h1 cm-md-heading cm-md-heading-collapsed" }),
	ATXHeading2: Decoration.line({ class: "cm-md-h2 cm-md-heading cm-md-heading-collapsed" }),
	ATXHeading3: Decoration.line({ class: "cm-md-h3 cm-md-heading cm-md-heading-collapsed" }),
	ATXHeading4: Decoration.line({ class: "cm-md-h4 cm-md-heading cm-md-heading-collapsed" }),
	ATXHeading5: Decoration.line({ class: "cm-md-h5 cm-md-heading cm-md-heading-collapsed" }),
	ATXHeading6: Decoration.line({ class: "cm-md-h6 cm-md-heading cm-md-heading-collapsed" }),
};

const hidden = Decoration.replace({});

type Callbacks = {
	onInlineCodeClick?: (text: string) => void;
	onHeadingMention?: (text: string) => void;
};

// Pill clicável para um trecho `inline code` — vira um mini-codeblock que copia ao clique.
// Reaparece como markup `\`...\`` quando o cursor está na linha (live-preview pattern).
class InlineCodeWidget extends WidgetType {
	constructor(
		readonly text: string,
		readonly onClick?: (text: string) => void,
	) {
		super();
	}

	eq(other: InlineCodeWidget) {
		return other.text === this.text;
	}

	toDOM() {
		const el = document.createElement("span");
		el.className = "cm-md-inline-code";
		el.textContent = this.text;
		el.title = "Clique para copiar";
		el.addEventListener("mousedown", (event) => {
			event.preventDefault();
			event.stopPropagation();
			this.onClick?.(this.text);
		});
		return el;
	}

	ignoreEvent() {
		return true;
	}
}

// Chevron à esquerda do heading: dispara o toggle de collapse. Aparece rotacionado
// quando o heading está recolhido para indicar o estado.
class HeadingChevronWidget extends WidgetType {
	constructor(
		readonly pos: number,
		readonly collapsed: boolean,
	) {
		super();
	}

	eq(other: HeadingChevronWidget) {
		return other.pos === this.pos && other.collapsed === this.collapsed;
	}

	toDOM(view: EditorView) {
		const el = document.createElement("button");
		el.type = "button";
		el.className = "cm-md-heading-chevron";
		el.dataset.collapsed = String(this.collapsed);
		el.tabIndex = -1;
		el.title = this.collapsed ? "Expandir" : "Recolher";
		el.innerHTML =
			'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
		el.addEventListener("mousedown", (event) => {
			event.preventDefault();
			event.stopPropagation();
			view.dispatch({ effects: toggleHeadingCollapse.of(this.pos) });
		});
		return el;
	}

	ignoreEvent() {
		return true;
	}
}

// Ícone "↪" no fim da linha do heading: aparece no hover e, ao clicar, manda o texto
// pro input de prompt sem mexer no caret/edição da linha.
class HeadingMentionWidget extends WidgetType {
	constructor(
		readonly text: string,
		readonly onClick?: (text: string) => void,
	) {
		super();
	}

	eq(other: HeadingMentionWidget) {
		return other.text === this.text;
	}

	toDOM() {
		const el = document.createElement("button");
		el.type = "button";
		el.className = "cm-md-heading-ref";
		el.textContent = "↪";
		el.title = "Mencionar este título no prompt";
		el.tabIndex = -1;
		el.addEventListener("mousedown", (event) => {
			event.preventDefault();
			event.stopPropagation();
			this.onClick?.(this.text);
		});
		return el;
	}

	ignoreEvent() {
		return true;
	}
}

// Botãozinho de copiar no canto superior direito do bloco de código. Posicionado
// absolute dentro da primeira linha (que tem `position: relative` via CSS) — aparece
// no hover do bloco.
class CodeBlockCopyWidget extends WidgetType {
	constructor(
		readonly text: string,
		readonly onClick?: (text: string) => void,
	) {
		super();
	}

	eq(other: CodeBlockCopyWidget) {
		return other.text === this.text;
	}

	toDOM() {
		const el = document.createElement("button");
		el.type = "button";
		el.className = "cm-md-code-copy";
		el.title = "Copiar bloco";
		el.tabIndex = -1;
		el.setAttribute("aria-label", "Copiar bloco de código");
		// SVG inline: ícone "copy" estilo lucide, herdando currentColor.
		el.innerHTML =
			'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
		el.addEventListener("mousedown", (event) => {
			event.preventDefault();
			event.stopPropagation();
			this.onClick?.(this.text);
		});
		return el;
	}

	ignoreEvent() {
		return true;
	}
}

type HeadingInfo = {
	pos: number;
	lineNum: number;
	lineTo: number;
	level: number;
	text: string;
};

function collectHeadings(view: EditorView): HeadingInfo[] {
	const { doc } = view.state;
	const out: HeadingInfo[] = [];
	syntaxTree(view.state).iterate({
		enter: (node) => {
			const match = /^ATXHeading([1-6])$/.exec(node.name);
			if (!match) return;
			const line = doc.lineAt(node.from);
			const raw = doc.sliceString(line.from, line.to);
			const stripped = raw.replace(/^#+\s*/, "").trim();
			out.push({
				pos: line.from,
				lineNum: line.number,
				lineTo: line.to,
				level: Number(match[1]),
				text: stripped,
			});
		},
	});
	return out;
}

function buildDecorations(view: EditorView, callbacks: Callbacks): DecorationSet {
	const { doc } = view.state;
	const selection = view.state.selection.main;
	const activeFrom = doc.lineAt(selection.from).from;
	const activeTo = doc.lineAt(selection.to).to;
	const collapsed = view.state.field(collapsedHeadingsField);

	const ranges: Range<Decoration>[] = [];

	// Passada global pelos headings: line class, chevron, widget de mencionar e
	// linhas escondidas pelos collapses. Roda sobre o doc inteiro porque o efeito
	// de colapso atravessa o viewport.
	const headings = collectHeadings(view);
	// lineNum → endLineNum (inclusive)
	const hideUntilLine = new Map<number, number>();
	for (let i = 0; i < headings.length; i++) {
		const h = headings[i];
		const isCollapsed = collapsed.has(h.pos);
		const lineClass = (isCollapsed ? headingLineCollapsed : headingLine)[`ATXHeading${h.level}`];
		if (lineClass) ranges.push(lineClass.range(h.pos));
		ranges.push(
			Decoration.widget({
				widget: new HeadingChevronWidget(h.pos, isCollapsed),
				side: -1,
			}).range(h.pos),
		);

		if (h.text) {
			ranges.push(
				Decoration.widget({
					widget: new HeadingMentionWidget(h.text, callbacks.onHeadingMention),
					side: 1,
				}).range(h.lineTo),
			);
		}

		if (isCollapsed) {
			let endLineNum = doc.lines;
			for (let j = i + 1; j < headings.length; j++) {
				if (headings[j].level <= h.level) {
					endLineNum = headings[j].lineNum - 1;
					break;
				}
			}
			if (endLineNum > h.lineNum) {
				hideUntilLine.set(h.lineNum + 1, endLineNum);
			}
		}
	}

	// Expande os ranges colapsados em line decorations linha-a-linha. Os intervalos
	// nunca se sobrepõem (cada heading collapsed para no próximo de nível ≤), então
	// um único cursor de linha basta.
	const hiddenLines = new Set<number>();
	for (const [start, end] of hideUntilLine) {
		for (let n = start; n <= end; n++) hiddenLines.add(n);
	}
	for (const n of [...hiddenLines].sort((a, b) => a - b)) {
		ranges.push(hiddenLine.range(doc.line(n).from));
	}

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: (node) => {
				if (node.name === "FencedCode") {
					const firstLine = doc.lineAt(node.from);
					const lastLine = doc.lineAt(node.to);
					for (let n = firstLine.number; n <= lastLine.number; n++) {
						const line = doc.line(n);
						const decoration =
							n === firstLine.number
								? codeBlockFirst
								: n === lastLine.number
									? codeBlockLast
									: codeBlockLine;
						ranges.push(decoration.range(line.from));
					}
					// Conteúdo do bloco sem as linhas de cerca (```lang … ```).
					const inner = doc
						.sliceString(firstLine.to, lastLine.from)
						.replace(/^\n/, "")
						.replace(/\n$/, "");
					if (inner) {
						ranges.push(
							Decoration.widget({
								widget: new CodeBlockCopyWidget(inner, callbacks.onInlineCodeClick),
								side: -1,
							}).range(firstLine.from),
						);
					}
					return;
				}

				// tratados na passada global
				if (node.name in headingLine) return;

				if (node.name === "InlineCode") {
					const onLine = node.to >= activeFrom && node.from <= activeTo;
					if (onLine) return;
					const text = doc.sliceString(node.from + 1, node.to - 1);
					ranges.push(
						Decoration.replace({
							widget: new InlineCodeWidget(text, callbacks.onInlineCodeClick),
						}).range(node.from, node.to),
					);
					return;
				}

				if (!HIDDEN_MARKS.has(node.name)) return;

				// Cursor na linha do marcador → mantém o markup visível para edição.
				if (node.to >= activeFrom && node.from <= activeTo) return;

				// `# ` come também o espaço logo depois do marcador.
				const end =
					node.name === "HeaderMark" && doc.sliceString(node.to, node.to + 1) === " "
						? node.to + 1
						: node.to;
				ranges.push(hidden.range(node.from, end));
			},
		});
	}

	return Decoration.set(ranges, true);
}

function livePreviewPlugin(callbacks: Callbacks) {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;

			constructor(view: EditorView) {
				this.decorations = buildDecorations(view, callbacks);
			}

			update(update: ViewUpdate) {
				const collapsedChanged =
					update.startState.field(collapsedHeadingsField) !==
					update.state.field(collapsedHeadingsField);
				if (
					update.docChanged ||
					update.selectionSet ||
					update.viewportChanged ||
					collapsedChanged
				) {
					this.decorations = buildDecorations(update.view, callbacks);
				}
			}
		},
		{ decorations: (plugin) => plugin.decorations },
	);
}

const baseTheme = EditorView.baseTheme({
	".cm-md-h1": { fontSize: "1.7em", fontWeight: "700", lineHeight: "1.3" },
	".cm-md-h2": { fontSize: "1.4em", fontWeight: "600", lineHeight: "1.3" },
	".cm-md-h3": { fontSize: "1.2em", fontWeight: "500", lineHeight: "1.35" },
	".cm-md-h4": { fontSize: "1.05em", fontWeight: "600" },
	".cm-md-h5": { fontSize: "1em", fontWeight: "600" },
	".cm-md-h6": { fontSize: "1em", fontWeight: "600", opacity: "0.8" },
	".cm-md-heading": { position: "relative" },
	".cm-md-collapsed": { display: "none" },
	// Headings recolhidos ganham margem inferior maior conforme o nível (h1 > h2 > h3…),
	// pra criar respiro proporcional onde antes havia o conteúdo escondido.
	".cm-md-h1.cm-md-heading-collapsed": { marginBottom: "1.2em" },
	".cm-md-h2.cm-md-heading-collapsed": { marginBottom: "0.9em" },
	".cm-md-h3.cm-md-heading-collapsed": { marginBottom: "0.65em" },
	".cm-md-h4.cm-md-heading-collapsed": { marginBottom: "0.45em" },
	".cm-md-h5.cm-md-heading-collapsed": { marginBottom: "0.3em" },
	".cm-md-h6.cm-md-heading-collapsed": { marginBottom: "0.25em" },
	".cm-md-heading-chevron": {
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		width: "1em",
		height: "1em",
		marginRight: "0.3em",
		padding: "0",
		color: "var(--muted-foreground)",
		background: "transparent",
		border: "none",
		cursor: "pointer",
		verticalAlign: "baseline",
		transition: "color 0.15s ease, transform 0.15s ease",
	},
	'.cm-md-heading-chevron[data-collapsed="true"]': { transform: "rotate(-90deg)" },
	".cm-md-heading-chevron:hover": { color: "var(--primary)" },
	".cm-md-heading-ref": {
		marginLeft: "0.5em",
		padding: "0 0.35em",
		fontSize: "0.7em",
		fontWeight: "400",
		lineHeight: "1.4",
		color: "var(--muted-foreground)",
		background: "transparent",
		border: "1px solid var(--border)",
		borderRadius: "3px",
		cursor: "pointer",
		opacity: "0",
		transition: "opacity 0.15s ease, color 0.15s ease, border-color 0.15s ease",
		verticalAlign: "middle",
	},
	".cm-md-heading:hover .cm-md-heading-ref": { opacity: "1" },
	".cm-md-heading-ref:hover": {
		color: "var(--primary)",
		borderColor: "var(--primary)",
	},
	".cm-md-code-block": {
		fontFamily: "var(--font-mono)",
		fontSize: "0.88em",
		lineHeight: "1.55",
		background: "color-mix(in oklab, var(--muted) 70%, transparent)",
		borderLeft: "1px solid var(--border)",
		borderRight: "1px solid var(--border)",
		paddingLeft: "0.9em !important",
		paddingRight: "0.9em !important",
		color: "var(--foreground)",
	},
	".cm-md-code-block-first": {
		position: "relative",
		borderTop: "1px solid var(--border)",
		borderTopLeftRadius: "6px",
		borderTopRightRadius: "6px",
		paddingTop: "0.55em !important",
		marginTop: "0.35em",
	},
	".cm-md-code-copy": {
		position: "absolute",
		top: "0.35em",
		right: "0.4em",
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		width: "1.7em",
		height: "1.7em",
		padding: "0",
		color: "var(--muted-foreground)",
		background: "color-mix(in oklab, var(--background) 70%, transparent)",
		border: "1px solid var(--border)",
		borderRadius: "4px",
		cursor: "pointer",
		opacity: "0",
		transition: "opacity 0.15s ease, color 0.15s ease, border-color 0.15s ease",
	},
	".cm-md-code-block:hover .cm-md-code-copy, .cm-md-code-copy:hover": { opacity: "1" },
	".cm-md-code-copy:hover": {
		color: "var(--primary)",
		borderColor: "var(--primary)",
	},
	".cm-md-code-block-last": {
		borderBottom: "1px solid var(--border)",
		borderBottomLeftRadius: "6px",
		borderBottomRightRadius: "6px",
		paddingBottom: "0.55em !important",
		marginBottom: "0.35em",
	},
	".cm-md-inline-code": {
		display: "inline-block",
		padding: "0.05em 0.4em",
		margin: "0 0.05em",
		fontFamily: "var(--font-mono)",
		fontSize: "0.92em",
		lineHeight: "1.4",
		color: "var(--foreground)",
		background: "color-mix(in oklab, var(--muted) 70%, transparent)",
		border: "1px solid var(--border)",
		borderRadius: "4px",
		cursor: "pointer",
		transition: "background-color 0.15s ease, border-color 0.15s ease",
		verticalAlign: "baseline",
	},
	".cm-md-inline-code:hover": {
		background: "color-mix(in oklab, var(--primary) 14%, var(--muted))",
		borderColor: "var(--primary)",
	},
});

export function markdownLivePreview(callbacks: Callbacks = {}) {
	return [collapsedHeadingsField, livePreviewPlugin(callbacks), baseTheme];
}
