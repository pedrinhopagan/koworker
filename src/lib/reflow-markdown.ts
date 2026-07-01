// Junta os hard-wraps de prosa: linhas físicas consecutivas de texto comum viram uma única linha
// lógica (o editor faz o soft-wrap visual via `EditorView.lineWrapping`). Preserva tudo que carrega
// significado de bloco — frontmatter, fences de código, tabelas, headings, listas, citações, réguas,
// blocos indentados, quebras explícitas (dois espaços ou "\" no fim) e as linhas em branco entre
// blocos. Os agents escrevem o `.md` como quiserem; a leitura normaliza. Idempotente.

const HEADING = /^\s{0,3}#{1,6}(\s|$)/;
const LIST = /^\s*([-*+]|\d{1,9}[.)])(\s|$)/;
const BLOCKQUOTE = /^\s{0,3}>/;
const INDENTED_CODE = /^(?: {4}|\t)/;
const HTML_BLOCK = /^\s{0,3}</;
// Régua (`---`, `***`, `___`) e sublinhado de setext (`===`, `---`): linhas só de `-`/`*`/`_`/`=`.
// Cobre os dois casos de uma vez pra nunca fundir um sublinhado na linha de cima.
const RULE_OR_SETEXT = /^\s{0,3}[-*_=]+\s*$/;

// Marcador de fence no início da linha (até 3 espaços de indent). Devolve o caractere e o
// comprimento pra casar abertura/fechamento (mesmo caractere, fechamento com comprimento ≥).
function fenceAt(line: string): { char: string; len: number } | null {
	const match = line.match(/^\s{0,3}(`{3,}|~{3,})/);
	if (!match) {
		return null;
	}
	return { char: match[1][0], len: match[1].length };
}

// Linha "juntável": prosa comum, fora de qualquer construção estrutural. Linha em branco e tudo que
// carrega significado de bloco ficam de fora — juntar essas corromperia a estrutura.
function isProse(line: string): boolean {
	if (line.trim() === "") {
		return false;
	}
	if (HEADING.test(line) || LIST.test(line) || BLOCKQUOTE.test(line)) {
		return false;
	}
	if (RULE_OR_SETEXT.test(line) || INDENTED_CODE.test(line) || HTML_BLOCK.test(line)) {
		return false;
	}
	// Pipe em qualquer lugar → trata como linha de tabela e não junta. Conservador de propósito: no
	// pior caso uma frase com `|` literal fica sem reflow (seguro), nunca uma tabela vira prosa.
	if (line.includes("|")) {
		return false;
	}
	return true;
}

// Quebra explícita no fim da linha (dois+ espaços ou "\"): o autor pediu o corte, então a linha
// seguinte não se funde nela — mas as duas seguem no mesmo parágrafo.
function endsWithHardBreak(line: string): boolean {
	return /(?: {2,}|\\)$/.test(line);
}

export function reflowMarkdown(src: string): string {
	const lines = src.split("\n");
	const out: string[] = [];
	let openParagraph = false;
	let inFrontmatter = false;
	let fence: { char: string; len: number } | null = null;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Frontmatter `---...---` só no topo do arquivo: copiado intacto até o fechamento.
		if (i === 0 && line.trim() === "---") {
			inFrontmatter = true;
			out.push(line);
			openParagraph = false;
			continue;
		}
		if (inFrontmatter) {
			out.push(line);
			const trimmed = line.trim();
			if (trimmed === "---" || trimmed === "...") {
				inFrontmatter = false;
			}
			openParagraph = false;
			continue;
		}

		// Fence de código: copiada intacta até o fechamento (mesmo caractere, comprimento ≥ e sem info).
		if (fence) {
			out.push(line);
			const closing = fenceAt(line);
			if (
				closing &&
				closing.char === fence.char &&
				closing.len >= fence.len &&
				line.trim().length === closing.len
			) {
				fence = null;
			}
			openParagraph = false;
			continue;
		}
		const opening = fenceAt(line);
		if (opening) {
			out.push(line);
			fence = opening;
			openParagraph = false;
			continue;
		}

		if (!isProse(line)) {
			out.push(line);
			openParagraph = false;
			continue;
		}

		// Prosa: funde na linha anterior do mesmo parágrafo, respeitando quebras explícitas.
		const prev = out.at(-1);
		if (openParagraph && prev !== undefined && !endsWithHardBreak(prev)) {
			out[out.length - 1] = `${prev.replace(/\s+$/, "")} ${line.trim()}`;
		} else {
			out.push(line);
		}
		openParagraph = true;
	}

	return out.join("\n");
}
