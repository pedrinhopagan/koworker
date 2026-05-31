// oxlint-disable max-classes-per-file -- vários WidgetType coesos do mesmo plugin CodeMirror
import { syntaxTree } from "@codemirror/language";
import { type EditorState, type Range, StateEffect, StateField } from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	EditorView,
	ViewPlugin,
	type ViewUpdate,
	WidgetType,
} from "@codemirror/view";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

import { Checkbox } from "@/components/ui/checkbox";

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

// Célula da tabela em edição: a tabela é identificada pela posição inicial (`from`) e a
// célula por linha (índice em `rows`, com a 0 = header) e coluna. Trocada via StateEffect
// e remapeada quando o doc muda.
type ActiveCell = { from: number; row: number; col: number };
const setActiveCell = StateEffect.define<ActiveCell | null>();

const activeCellField = StateField.define<ActiveCell | null>({
	create() {
		return null;
	},
	update(value, tr) {
		for (const effect of tr.effects) {
			if (effect.is(setActiveCell)) return effect.value;
		}
		if (value && tr.docChanged) {
			return { ...value, from: tr.changes.mapPos(value.from, -1) };
		}
		return value;
	},
});

// Tabelas viram block widgets (que o CodeMirror só aceita vindos de um StateField: um
// ViewPlugin não pode prover decorations que substituem quebras de linha). A tabela fica
// sempre renderizada; a célula ativa vira um <input> editável no lugar. Recalcula quando o
// doc muda, quando a célula ativa muda e quando o parser avança um tick depois da edição.
function buildTableDecorations(state: EditorState): DecorationSet {
	const { doc } = state;
	const active = state.field(activeCellField);
	const ranges: Range<Decoration>[] = [];
	syntaxTree(state).iterate({
		enter: (node) => {
			if (node.name !== "Table") return;
			const firstLine = doc.lineAt(node.from);
			const lastLine = doc.lineAt(node.to);
			const rows: { from: number; text: string }[] = [];
			for (let n = firstLine.number; n <= lastLine.number; n++) {
				const line = doc.line(n);
				rows.push({ from: line.from, text: line.text });
			}
			if (rows.length >= 2) {
				const cell = active && active.from === node.from ? active : null;
				ranges.push(
					Decoration.replace({
						widget: new TableWidget(node.from, rows, cell),
						block: true,
					}).range(firstLine.from, lastLine.to),
				);
			}
			return false;
		},
	});
	return Decoration.set(ranges, true);
}

const tableDecorationsField = StateField.define<DecorationSet>({
	create(state) {
		return buildTableDecorations(state);
	},
	update(value, tr) {
		const activeChanged = tr.startState.field(activeCellField) !== tr.state.field(activeCellField);
		const treeChanged = syntaxTree(tr.startState) !== syntaxTree(tr.state);
		if (tr.docChanged || activeChanged || treeChanged) {
			return buildTableDecorations(tr.state);
		}
		return value;
	},
	provide: (f) => EditorView.decorations.from(f),
});

// Marcadores de estilo de texto (`**`, `_`, `~~`) que ficam SEMPRE escondidos, mesmo com o
// cursor na linha — o estilo continua aplicado e o markup só reaparece quando deletado, igual
// ao `==` do Highlight. Escrever dentro do estilo nunca expõe os delimitadores.
const ALWAYS_HIDDEN_MARKS = new Set(["EmphasisMark", "StrikethroughMark"]);

// Marcadores estruturais que somem só quando o cursor não está na linha (estilo "live preview"
// do Obsidian). `ListMark` fica de fora de propósito: esconder `- ` apagaria o marcador da lista.
const CURSOR_HIDDEN_MARKS = new Set([
	"HeaderMark",
	"QuoteMark",
	"LinkMark",
	"CodeMark",
	"CodeInfo",
]);

const codeBlockLine = Decoration.line({ class: "cm-md-code-block" });
const codeBlockFirst = Decoration.line({ class: "cm-md-code-block cm-md-code-block-first" });
const codeBlockLast = Decoration.line({ class: "cm-md-code-block cm-md-code-block-last" });
const codeBlockOnly = Decoration.line({
	class: "cm-md-code-block cm-md-code-block-first cm-md-code-block-last",
});

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

// `---` (HorizontalRule) fora do foco vira uma régua de verdade no lugar do texto; com o cursor na
// linha, os `---` reaparecem pra editar. `block: false` mantém o widget no fluxo da linha.
class DividerWidget extends WidgetType {
	eq() {
		return true;
	}

	toDOM() {
		const el = document.createElement("span");
		el.className = "cm-md-divider";
		return el;
	}

	ignoreEvent() {
		return true;
	}
}

const divider = Decoration.replace({ widget: new DividerWidget() });

// Estilo de pill para `inline code`: só decora, mantendo o texto totalmente editável.
const inlineCodeMark = Decoration.mark({ class: "cm-md-inline-code" });

// Fundo de "grifa-texto" para `==destaque==`; os `==` ficam sempre escondidos (tratado no nó Highlight).
const highlightMark = Decoration.mark({ class: "cm-md-highlight" });

type Callbacks = {
	onInlineCodeClick?: (text: string) => void;
	onHeadingMention?: (text: string) => void;
};

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

// Checkbox real e clicável no lugar do `[ ]`/`[x]` de uma task list GFM, usando o
// `<Checkbox>` padrão do projeto montado num root React. O clique alterna o caractere
// interno no doc (` ` ↔ `x`), mantendo o `.md` cru como fonte da verdade.
class TaskCheckboxWidget extends WidgetType {
	root?: Root;

	constructor(
		readonly from: number,
		readonly checked: boolean,
	) {
		super();
	}

	eq(other: TaskCheckboxWidget) {
		return other.from === this.from && other.checked === this.checked;
	}

	toDOM(view: EditorView) {
		const el = document.createElement("span");
		el.className = "cm-md-task-checkbox";
		el.addEventListener("mousedown", (event) => {
			event.preventDefault();
			event.stopPropagation();
			view.dispatch({
				changes: { from: this.from + 1, to: this.from + 2, insert: this.checked ? " " : "x" },
			});
		});
		this.root = createRoot(el);
		this.root.render(createElement(Checkbox, { checked: this.checked, size: "em", tabIndex: -1 }));
		return el;
	}

	destroy() {
		const root = this.root;
		// Desmonta fora do ciclo de update do CodeMirror para evitar o warning do React.
		if (root) queueMicrotask(() => root.unmount());
	}

	ignoreEvent() {
		return true;
	}
}

// Divide uma linha de tabela GFM nas células, descartando as bordas `|` externas e
// tratando o escape `\|`. Trim de cada célula.
function splitTableCells(line: string): string[] {
	const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
	const cells: string[] = [];
	let buf = "";
	for (let i = 0; i < trimmed.length; i++) {
		const ch = trimmed[i];
		if (ch === "\\" && trimmed[i + 1] === "|") {
			buf += "|";
			i++;
			continue;
		}
		if (ch === "|") {
			cells.push(buf.trim());
			buf = "";
			continue;
		}
		buf += ch;
	}
	cells.push(buf.trim());
	return cells;
}

type CellAlign = "left" | "center" | "right" | null;

// Alinhamento de cada coluna a partir da linha delimitadora (`:---`, `:--:`, `---:`).
function cellAlign(spec: string): CellAlign {
	const s = spec.trim();
	const left = s.startsWith(":");
	const right = s.endsWith(":");
	if (left && right) return "center";
	if (right) return "right";
	if (left) return "left";
	return null;
}

// Render inline mínimo dentro das células: `code` vira pill e `**bold**` vira <strong>.
// Constrói nós de texto (sem innerHTML) para não injetar HTML do conteúdo do arquivo.
function appendBold(parent: HTMLElement, text: string) {
	const parts = text.split(/\*\*([^*]+?)\*\*/);
	for (let i = 0; i < parts.length; i++) {
		if (!parts[i]) continue;
		if (i % 2 === 1) {
			const strong = document.createElement("strong");
			strong.textContent = parts[i];
			parent.append(strong);
		} else {
			parent.append(parts[i]);
		}
	}
}

function renderCellInline(parent: HTMLElement, text: string) {
	const parts = text.split("`");
	for (let i = 0; i < parts.length; i++) {
		// Índice ímpar entre dois backticks → trecho de código.
		if (i % 2 === 1 && i !== parts.length - 1) {
			const code = document.createElement("code");
			code.textContent = parts[i];
			parent.append(code);
		} else {
			appendBold(parent, parts[i]);
		}
	}
}

// Reescreve a linha `rowIndex` da tabela (que começa em `tableFrom`) trocando a célula
// `colIndex` pelo valor editado. Normaliza espaçamento, junta com `|` e reescapa `|`
// literais. Retorna null quando nada muda. Recalcula do doc atual para resistir a edições.
function commitCellChange(
	view: EditorView,
	tableFrom: number,
	rowIndex: number,
	colIndex: number,
	value: string,
) {
	const { doc } = view.state;
	const lineNum = doc.lineAt(tableFrom).number + rowIndex;
	if (lineNum > doc.lines) return null;
	const line = doc.line(lineNum);
	const cells = splitTableCells(line.text);
	if (colIndex >= cells.length) return null;
	cells[colIndex] = value.replaceAll(/\s*\n\s*/g, " ").trim();
	const rebuilt = `| ${cells.map((c) => c.replaceAll("|", "\\|")).join(" | ")} |`;
	if (rebuilt === line.text) return null;
	return { from: line.from, to: line.to, insert: rebuilt };
}

// Próxima célula editável na ordem de leitura, pulando a linha delimitadora (índice 1).
function stepCell(rowsLen: number, cols: number, row: number, col: number, forward: boolean) {
	const seq: { row: number; col: number }[] = [];
	for (let r = 0; r < rowsLen; r++) {
		if (r === 1) continue;
		for (let c = 0; c < cols; c++) seq.push({ row: r, col: c });
	}
	const idx = seq.findIndex((s) => s.row === row && s.col === col);
	const next = idx + (forward ? 1 : -1);
	if (idx < 0 || next < 0 || next >= seq.length) return null;
	return seq[next];
}

// Tabela GFM sempre renderizada como <table> de verdade. A célula ativa (estado em
// `activeCellField`) vira um <input> editável no lugar; as demais ficam com os pills. A
// edição commita ao sair da célula (Enter, Tab, clique em outra célula ou foco pra fora),
// reescrevendo a linha no `.md` cru. Estilo "live preview" do Obsidian.
class TableWidget extends WidgetType {
	readonly key: string;

	constructor(
		readonly from: number,
		readonly rows: { from: number; text: string }[],
		readonly active: ActiveCell | null,
	) {
		super();
		this.key = rows.map((r) => r.text).join("\n");
	}

	eq(other: TableWidget) {
		return (
			other.from === this.from &&
			other.key === this.key &&
			other.active?.row === this.active?.row &&
			other.active?.col === this.active?.col
		);
	}

	toDOM(view: EditorView) {
		const [header, delimiter, ...body] = this.rows;
		const aligns = splitTableCells(delimiter.text).map(cellAlign);
		const cols = splitTableCells(header.text).length;
		const active = this.active;
		let activeInput: HTMLTextAreaElement | null = null;

		// Commita a célula ativa (se houver valor pendente) e move o foco para `target`.
		const dispatchCell = (target: ActiveCell | null, commit: boolean) => {
			const change =
				commit && active && activeInput
					? commitCellChange(view, this.from, active.row, active.col, activeInput.value)
					: null;
			view.dispatch({ changes: change ?? undefined, effects: setActiveCell.of(target) });
		};

		const renderCell = (
			el: HTMLTableCellElement,
			rowIndex: number,
			colIndex: number,
			text: string,
		) => {
			if (aligns[colIndex]) el.style.textAlign = aligns[colIndex] as string;

			if (active && active.row === rowIndex && active.col === colIndex) {
				// Textarea (não input) pra manter o wrap da célula durante a edição; cresce em
				// altura conforme o conteúdo. A célula segue sendo uma linha do .md: Enter
				// commita em vez de inserir quebra, e `\n` colado é normalizado no commit.
				const textarea = document.createElement("textarea");
				textarea.className = "cm-md-table-input";
				textarea.rows = 1;
				textarea.value = text;
				const autoGrow = () => {
					textarea.style.height = "auto";
					textarea.style.height = `${textarea.scrollHeight}px`;
				};
				textarea.addEventListener("input", autoGrow);
				textarea.addEventListener("mousedown", (event) => event.stopPropagation());
				textarea.addEventListener("keydown", (event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						dispatchCell(null, true);
					} else if (event.key === "Escape") {
						event.preventDefault();
						dispatchCell(null, false);
					} else if (event.key === "Tab") {
						event.preventDefault();
						const step = stepCell(this.rows.length, cols, rowIndex, colIndex, !event.shiftKey);
						dispatchCell(step ? { from: this.from, row: step.row, col: step.col } : null, true);
					}
				});
				textarea.addEventListener("blur", () => {
					// Microtask: se o textarea ainda estiver no DOM o blur foi para fora da tabela
					// (commita e fecha); se sumiu, foi um rebuild que já cuidou da troca.
					queueMicrotask(() => {
						if (textarea.isConnected) dispatchCell(null, true);
					});
				});
				activeInput = textarea;
				el.append(textarea);
				// Foco e altura só depois do DOM montado (medir scrollHeight antes não pega).
				requestAnimationFrame(() => {
					textarea.focus();
					textarea.setSelectionRange(textarea.value.length, textarea.value.length);
					autoGrow();
				});
				return;
			}

			renderCellInline(el, text);
			el.addEventListener("mousedown", (event) => {
				event.preventDefault();
				event.stopPropagation();
				dispatchCell({ from: this.from, row: rowIndex, col: colIndex }, true);
			});
		};

		const wrapper = document.createElement("div");
		wrapper.className = "cm-md-table-wrapper";

		const table = document.createElement("table");
		table.className = "cm-md-table";

		const thead = document.createElement("thead");
		const headerRow = document.createElement("tr");
		splitTableCells(header.text).forEach((cell, i) => {
			const th = document.createElement("th");
			renderCell(th, 0, i, cell);
			headerRow.append(th);
		});
		thead.append(headerRow);
		table.append(thead);

		const tbody = document.createElement("tbody");
		body.forEach((row, k) => {
			const tr = document.createElement("tr");
			splitTableCells(row.text).forEach((cell, i) => {
				const td = document.createElement("td");
				renderCell(td, k + 2, i, cell);
				tr.append(td);
			});
			tbody.append(tr);
		});
		table.append(tbody);
		wrapper.append(table);

		return wrapper;
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

// `---\n…\n---` no topo do arquivo é frontmatter (metadados), não um divider. Devolve o fim do bloco
// (posição do fechamento) pra pular esses delimitadores; -1 quando não há frontmatter. O `---` de
// abertura parseia como HorizontalRule e o de fechamento como SetextHeading, então pular o range
// inteiro cobre os dois casos sem depender de qual nó cada delimitador virou.
function frontmatterEnd(doc: EditorState["doc"]): number {
	if (doc.lines < 2 || doc.line(1).text.trim() !== "---") return -1;
	for (let n = 2; n <= doc.lines; n++) {
		const text = doc.line(n).text.trim();
		if (text === "---" || text === "...") return doc.line(n).to;
	}
	return -1;
}

function buildDecorations(view: EditorView, callbacks: Callbacks): DecorationSet {
	const { doc } = view.state;
	const frontmatterTo = frontmatterEnd(doc);
	const selection = view.state.selection.main;
	// Sem foco, nenhuma linha conta como ativa: os marcadores da linha do cursor também somem e o
	// texto fica "limpo". Clicar fora do editor (na margem) tira o foco e dispara essa limpeza.
	const activeFrom = view.hasFocus ? doc.lineAt(selection.from).from : -1;
	const activeTo = view.hasFocus ? doc.lineAt(selection.to).to : -1;
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
				// Tabelas são tratadas pelo tableDecorationsField (block widget). Não descemos
				// nas células pra não sobrepor marks inline ao block replace do field.
				if (node.name === "Table") return false;

				if (node.name === "FencedCode") {
					const firstLine = doc.lineAt(node.from);
					const lastLine = doc.lineAt(node.to);
					const single = firstLine.number === lastLine.number;
					// Cada cerca (```lang / ```) só reaparece quando o cursor está naquela linha;
					// fora disso ela some, então o visual do bloco se mantém mesmo editando o
					// conteúdo. As bordas arredondadas ficam nas pontas atualmente visíveis.
					const firstActive = firstLine.from <= activeTo && firstLine.to >= activeFrom;
					const lastActive = lastLine.from <= activeTo && lastLine.to >= activeFrom;

					const styleStart = firstActive ? firstLine.number : firstLine.number + 1;
					const styleEnd = single || lastActive ? lastLine.number : lastLine.number - 1;

					if (!firstActive) ranges.push(hiddenLine.range(firstLine.from));
					if (!single && !lastActive) ranges.push(hiddenLine.range(lastLine.from));

					for (let n = styleStart; n <= styleEnd; n++) {
						const line = doc.line(n);
						const decoration =
							styleStart === styleEnd
								? codeBlockOnly
								: n === styleStart
									? codeBlockFirst
									: n === styleEnd
										? codeBlockLast
										: codeBlockLine;
						ranges.push(decoration.range(line.from));
					}

					// Conteúdo do bloco sem as linhas de cerca (```lang … ```).
					const inner = doc
						.sliceString(firstLine.to, lastLine.from)
						.replace(/^\n/, "")
						.replace(/\n$/, "");
					if (inner && styleEnd >= styleStart) {
						ranges.push(
							Decoration.widget({
								widget: new CodeBlockCopyWidget(inner, callbacks.onInlineCodeClick),
								side: -1,
							}).range(doc.line(styleStart).from),
						);
					}
					return false;
				}

				if (node.name === "HorizontalRule") {
					// Delimitador de frontmatter no topo → não é divider, fica como está.
					if (node.from <= frontmatterTo) return false;
					const line = doc.lineAt(node.from);
					const lineActive = line.from <= activeTo && line.to >= activeFrom;
					// Com o cursor na linha, mantém os `---` editáveis; fora dela, vira a régua.
					if (!lineActive) ranges.push(divider.range(line.from, line.to));
					return false;
				}

				if (node.name === "TaskMarker") {
					const checked = doc.sliceString(node.from + 1, node.to - 1).toLowerCase() === "x";
					ranges.push(
						Decoration.replace({
							widget: new TaskCheckboxWidget(node.from, checked),
						}).range(node.from, node.to),
					);
					return;
				}

				// tratados na passada global
				if (node.name in headingLine) return;

				if (node.name === "Highlight") {
					// Fundo no miolo + os `==` sempre escondidos (igual ao inline code), some o ruído
					// dos marcadores assim que a grifa existe. Desce pra estilizar *bold*/_italic_
					// aninhados; pra tirar a grifa use Ctrl+H (os `==` não ficam à mão no preview).
					const innerFrom = node.from + 2;
					const innerTo = node.to - 2;
					if (innerTo > innerFrom) ranges.push(highlightMark.range(innerFrom, innerTo));
					ranges.push(hidden.range(node.from, innerFrom));
					ranges.push(hidden.range(innerTo, node.to));
					return;
				}

				if (node.name === "InlineCode") {
					// Pill sempre presente com os backticks escondidos, mesmo com o cursor dentro:
					// edita-se o conteúdo mantendo o visual. O conteúdo segue como texto comum.
					const innerFrom = node.from + 1;
					const innerTo = node.to - 1;
					if (innerTo > innerFrom) {
						ranges.push(inlineCodeMark.range(innerFrom, innerTo));
					}
					ranges.push(hidden.range(node.from, innerFrom));
					ranges.push(hidden.range(innerTo, node.to));
					return false;
				}

				// Estilos de texto: marcadores sempre escondidos, independente do cursor.
				if (ALWAYS_HIDDEN_MARKS.has(node.name)) {
					ranges.push(hidden.range(node.from, node.to));
					return;
				}

				if (!CURSOR_HIDDEN_MARKS.has(node.name)) return;

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
					update.focusChanged ||
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
	// Régua de `---`: ocupa a largura da linha como uma borda fina centrada verticalmente.
	".cm-md-divider": {
		display: "inline-block",
		width: "100%",
		height: "0",
		verticalAlign: "middle",
		borderTop: "1px solid var(--border)",
	},
	// Headings recolhidos ganham margem inferior maior conforme o nível (h1 > h2 > h3…),
	// pra criar respiro proporcional onde antes havia o conteúdo escondido.
	".cm-md-h1.cm-md-heading-collapsed": { paddingBottom: "1.2em" },
	".cm-md-h2.cm-md-heading-collapsed": { paddingBottom: "0.9em" },
	".cm-md-h3.cm-md-heading-collapsed": { paddingBottom: "0.65em" },
	".cm-md-h4.cm-md-heading-collapsed": { paddingBottom: "0.45em" },
	".cm-md-h5.cm-md-heading-collapsed": { paddingBottom: "0.3em" },
	".cm-md-h6.cm-md-heading-collapsed": { paddingBottom: "0.25em" },
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
		marginRight: "0.5rem",
		color: "var(--foreground)",
	},
	".cm-md-code-block-first": {
		position: "relative",
		borderTop: "1px solid var(--border)",
		borderTopLeftRadius: "6px",
		borderTopRightRadius: "6px",
		paddingTop: "0.9em !important",
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
		paddingBottom: "0.9em !important",
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
		cursor: "text",
		transition: "background-color 0.15s ease, border-color 0.15s ease",
		verticalAlign: "baseline",
	},
	".cm-md-inline-code:hover": {
		background: "color-mix(in oklab, var(--primary) 14%, var(--muted))",
		borderColor: "var(--primary)",
	},
	".cm-md-highlight": {
		padding: "0.05em 0.15em",
		borderRadius: "3px",
		// Grifa âmbar translúcida — funciona sobre o fundo escuro mantendo o texto legível.
		background: "color-mix(in oklab, #facc15 30%, transparent)",
		color: "var(--foreground)",
		boxDecorationBreak: "clone",
	},
	".cm-md-task-checkbox": {
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		height: "1em",
		marginRight: "0.4em",
		verticalAlign: "middle",
	},
	".cm-md-table-wrapper": {
		margin: "0.4em 0.5rem 0.7em 0",
		overflowX: "auto",
		border: "1px solid var(--border)",
		borderRadius: "6px",
		cursor: "text",
	},
	".cm-md-table": {
		borderCollapse: "collapse",
		width: "100%",
		fontSize: "0.92em",
		lineHeight: "1.5",
	},
	".cm-md-table th, .cm-md-table td": {
		padding: "0.4em 0.75em",
		textAlign: "left",
		verticalAlign: "top",
		borderRight: "1px solid var(--border)",
		borderBottom: "1px solid var(--border)",
	},
	".cm-md-table th:last-child, .cm-md-table td:last-child": { borderRight: "none" },
	".cm-md-table tbody tr:last-child td": { borderBottom: "none" },
	".cm-md-table th": {
		fontWeight: "600",
		background: "color-mix(in oklab, var(--muted) 60%, transparent)",
	},
	".cm-md-table tbody tr:hover": {
		background: "color-mix(in oklab, var(--muted) 35%, transparent)",
	},
	".cm-md-table code": {
		padding: "0.05em 0.35em",
		fontFamily: "var(--font-mono)",
		fontSize: "0.9em",
		background: "color-mix(in oklab, var(--muted) 70%, transparent)",
		border: "1px solid var(--border)",
		borderRadius: "4px",
	},
	".cm-md-table-input": {
		display: "block",
		boxSizing: "border-box",
		width: "100%",
		margin: "0",
		padding: "0",
		font: "inherit",
		lineHeight: "inherit",
		color: "inherit",
		textAlign: "inherit",
		background: "transparent",
		border: "none",
		outline: "none",
		resize: "none",
		overflow: "hidden",
		whiteSpace: "pre-wrap",
		overflowWrap: "anywhere",
	},
});

export function markdownLivePreview(callbacks: Callbacks = {}) {
	return [
		collapsedHeadingsField,
		activeCellField,
		tableDecorationsField,
		livePreviewPlugin(callbacks),
		baseTheme,
	];
}
