// Âncora de leitura resiliente: o ponto de leitura de um documento é representado pelo heading mais
// próximo ACIMA do topo do viewport mais um deslocamento em pixels dentro da seção. Pixel cru não
// serve — o modo leitura troca `fontSize` e o tema do CodeMirror sem remontar, e qualquer edição
// desloca tudo. Estas funções são puras (sem CodeMirror): a matemática de viewport mora no editor.

export type HeadingAnchor = {
	// Texto do heading mais próximo acima do topo do viewport. `null` ⇒ scroll está acima do 1º
	// heading; nesse caso `offsetPx` é o `scrollTop` cru.
	headingText: string | null;
	// 1..6 — desambigua headings com o mesmo texto em níveis diferentes.
	level: number;
	// n-ésima ocorrência (1-based) de `(text, level)` no documento — trata headings repetidos.
	occurrence: number;
	// Deslocamento dentro da seção, abaixo do topo do heading (ou `scrollTop` cru quando antes do 1º).
	offsetPx: number;
};

type Heading = {
	text: string;
	level: number;
	// Linha 1-based onde o heading começa.
	line: number;
};

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const FENCE_RE = /^\s*(`{3,}|~{3,})/;

// Headings ATX (`# ...`) fora de blocos de código cercados. Rastreia fences (``` e ~~~) pra não
// confundir um `# comentário` dentro de uma fence de shell com um heading de verdade.
export function headingsOf(doc: string): Heading[] {
	const lines = doc.split("\n");
	const headings: Heading[] = [];
	let fence: string | null = null;

	for (let i = 0; i < lines.length; i++) {
		const fenceMatch = FENCE_RE.exec(lines[i]);
		if (fenceMatch) {
			const marker = fenceMatch[1][0];
			if (!fence) {
				fence = marker;
			} else if (fence === marker) {
				fence = null;
			}
			continue;
		}

		if (fence) {
			continue;
		}

		const match = HEADING_RE.exec(lines[i]);
		if (match) {
			headings.push({ level: match[1].length, text: match[2].trim(), line: i + 1 });
		}
	}

	return headings;
}

// Heading mais próximo acima (ou na) `topLine`, já com a ocorrência calculada. `null` quando o topo
// está acima do primeiro heading do documento.
export function anchorAtLine(
	doc: string,
	topLine: number,
): { headingText: string; level: number; occurrence: number; headingLine: number } | null {
	const headings = headingsOf(doc);

	let current: Heading | null = null;
	for (const heading of headings) {
		if (heading.line > topLine) {
			break;
		}
		current = heading;
	}

	if (!current) {
		return null;
	}

	let occurrence = 0;
	for (const heading of headings) {
		if (heading.text === current.text && heading.level === current.level) {
			occurrence++;
		}
		if (heading.line === current.line) {
			break;
		}
	}

	return { headingText: current.text, level: current.level, occurrence, headingLine: current.line };
}

// Resolve a âncora de volta numa linha 1-based: match exato `text+level+occurrence` → fallback
// `text+level` (1ª ocorrência) → `null` quando o heading sumiu do documento.
export function lineForAnchor(doc: string, anchor: HeadingAnchor): number | null {
	if (anchor.headingText === null) {
		return null;
	}

	const headings = headingsOf(doc);
	const sameLabel = headings.filter(
		(heading) => heading.text === anchor.headingText && heading.level === anchor.level,
	);

	if (!sameLabel.length) {
		return null;
	}

	return (sameLabel[anchor.occurrence - 1] ?? sameLabel[0]).line;
}

// Offset (índice de caractere) do início de uma linha 1-based — espelha `doc.line(n).from` do
// CodeMirror pra posicionar a seleção inicial sem precisar do editor montado.
export function offsetOfLine(doc: string, line: number): number {
	const lines = doc.split("\n");
	let offset = 0;
	for (let i = 0; i < line - 1 && i < lines.length; i++) {
		offset += lines[i].length + 1;
	}
	return offset;
}
