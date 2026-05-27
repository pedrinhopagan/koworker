import { syntaxTree } from "@codemirror/language";
import type { Range } from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	EditorView,
	ViewPlugin,
	type ViewUpdate,
} from "@codemirror/view";

// Marcadores de sintaxe que somem quando o cursor não está na linha (estilo "live preview" do Obsidian).
// `ListMark` fica de fora de propósito: esconder `- ` apagaria o marcador da lista.
const HIDDEN_MARKS = new Set([
	"HeaderMark",
	"EmphasisMark",
	"StrikethroughMark",
	"CodeMark",
	"QuoteMark",
	"LinkMark",
]);

const headingLine: Record<string, Decoration> = {
	ATXHeading1: Decoration.line({ class: "cm-md-h1" }),
	ATXHeading2: Decoration.line({ class: "cm-md-h2" }),
	ATXHeading3: Decoration.line({ class: "cm-md-h3" }),
	ATXHeading4: Decoration.line({ class: "cm-md-h4" }),
	ATXHeading5: Decoration.line({ class: "cm-md-h5" }),
	ATXHeading6: Decoration.line({ class: "cm-md-h6" }),
};

const hidden = Decoration.replace({});

function buildDecorations(view: EditorView): DecorationSet {
	const { doc } = view.state;
	const selection = view.state.selection.main;
	const activeFrom = doc.lineAt(selection.from).from;
	const activeTo = doc.lineAt(selection.to).to;

	const ranges: Range<Decoration>[] = [];

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: (node) => {
				const lineDecoration = headingLine[node.name];
				if (lineDecoration) {
					ranges.push(lineDecoration.range(doc.lineAt(node.from).from));
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

const livePreviewPlugin = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = buildDecorations(view);
		}

		update(update: ViewUpdate) {
			if (update.docChanged || update.selectionSet || update.viewportChanged) {
				this.decorations = buildDecorations(update.view);
			}
		}
	},
	{ decorations: (plugin) => plugin.decorations },
);

const headingTheme = EditorView.baseTheme({
	".cm-md-h1": { fontSize: "1.7em", fontWeight: "700", lineHeight: "1.3" },
	".cm-md-h2": { fontSize: "1.4em", fontWeight: "600", lineHeight: "1.3" },
	".cm-md-h3": { fontSize: "1.2em", fontWeight: "500", lineHeight: "1.35" },
	".cm-md-h4": { fontSize: "1.05em", fontWeight: "600" },
	".cm-md-h5": { fontSize: "1em", fontWeight: "600" },
	".cm-md-h6": { fontSize: "1em", fontWeight: "600", opacity: "0.8" },
});

export const markdownLivePreview = [livePreviewPlugin, headingTheme];
