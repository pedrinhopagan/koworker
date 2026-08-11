import { HighlightStyle, LanguageDescription, type LanguageSupport } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { tags as t } from "@lezer/highlight";
import {
	GFM,
	parser as baseMarkdownParser,
	type DelimiterType,
	type MarkdownConfig,
} from "@lezer/markdown";
import { StyleModule } from "style-mod";

// O motor de markdown do app: um único parser, um único mapa de cores de sintaxe e uma única
// resolução de linguagem de fence. O editor com live preview (`markdown-doc`) e a leitura estática
// (`markdown-view`) montam superfícies diferentes por cima daqui, mas nunca reinterpretam markdown
// por conta própria — mudar uma regra aqui muda o `.md` do vault e a fala do agente ao mesmo tempo.

// `==texto==` não faz parte do CommonMark. Espelha o Strikethrough do GFM: um delimitador
// `==` simétrico que o parser casa e envolve num nó Highlight, com os `==` virando HighlightMark.
const highlightDelimiter: DelimiterType = { resolve: "Highlight", mark: "HighlightMark" };

export const highlightExtension: MarkdownConfig = {
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

export const markdownHighlightStyle = HighlightStyle.define([
	{ tag: t.strong, fontWeight: "700" },
	{ tag: t.emphasis, fontStyle: "italic" },
	{ tag: t.strikethrough, textDecoration: "line-through" },
	{ tag: t.link, color: "var(--primary)", textDecoration: "underline" },
	{ tag: t.url, color: "var(--muted-foreground)" },
	{ tag: t.contentSeparator, fontFamily: "var(--font-mono)" },
	{ tag: t.quote, color: "var(--muted-foreground)", fontStyle: "italic" },
	{ tag: t.list, color: "var(--muted-foreground)" },
	{ tag: t.heading, fontWeight: "700" },
	// Palavras-chave / controle de fluxo → vermelho terroso (mesma hue do destructive).
	{
		tag: [t.keyword, t.moduleKeyword, t.operatorKeyword, t.controlKeyword],
		color: "var(--syntax-keyword)",
	},
	// Strings → verde oliva (hue do primary), o "conteúdo literal" do tema.
	{ tag: [t.string, t.special(t.string), t.regexp], color: "var(--syntax-string)" },
	// Números, booleanos e átomos → âmbar (hue do warning).
	{ tag: [t.number, t.bool, t.null, t.atom], color: "var(--syntax-number)" },
	// Comentários → cinza apagado do tema, em itálico.
	{
		tag: [t.comment, t.lineComment, t.blockComment],
		color: "var(--muted-foreground)",
		fontStyle: "italic",
	},
	// Variáveis e propriedades → texto base.
	{ tag: [t.variableName, t.propertyName], color: "var(--foreground)" },
	// Funções → ciano dessaturado, único tom frio pra destacar a chamada sem brigar com o verde.
	{
		tag: [t.function(t.variableName), t.function(t.propertyName)],
		color: "var(--syntax-function)",
	},
	// Tipos, classes e namespaces → teal esverdeado.
	{ tag: [t.typeName, t.className, t.namespace], color: "var(--syntax-type)" },
	// Tags HTML/JSX e colchetes angulares → verde oliva, como as strings.
	{ tag: [t.tagName, t.angleBracket], color: "var(--syntax-string)" },
	// Atributos → âmbar, igual aos valores literais.
	{ tag: [t.attributeName], color: "var(--syntax-number)" },
	// Operadores e pontuação → texto base levemente apagado.
	{
		tag: [t.operator, t.punctuation, t.separator, t.derefOperator],
		color: "var(--muted-foreground)",
	},
]);

// Dentro do editor quem monta as classes do highlight é a extensão `syntaxHighlighting`. Fora dele
// ninguém monta, e as classes que o `highlightTree` devolve ficariam sem CSS: a leitura estática
// pede a montagem uma vez e o mesmo StyleModule serve as duas superfícies.
let highlightMounted = false;

export function mountMarkdownHighlightStyle() {
	if (highlightMounted || typeof document === "undefined" || !markdownHighlightStyle.module) {
		return;
	}
	highlightMounted = true;
	StyleModule.mount(document, markdownHighlightStyle.module);
}

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
export function resolveCodeLanguage(info: string) {
	const name = languageAliases[info.toLowerCase()] ?? info;
	return LanguageDescription.matchLanguageName(languages, name, true);
}

// O parser da leitura estática. É a mesma receita que o `markdownLanguage` do editor monta —
// CommonMark + GFM + a grifa `==` do app —, só que sem o embrulho de linguagem do CodeMirror, que
// fora de um editor não teria o que fazer.
export const markdownParser = baseMarkdownParser.configure([GFM, highlightExtension]);

// O editor recarrega sozinho quando o parser de uma fence chega; a leitura estática precisa saber
// disso na mão. Cada linguagem é pedida uma vez só e quem estiver na tela redesenha ao resolver.
const pendingLanguages = new Set<string>();
const languageListeners = new Set<() => void>();
let languageVersion = 0;

export function loadedCodeLanguage(info: string): LanguageSupport | null {
	const description = resolveCodeLanguage(info);
	if (!description) {
		return null;
	}

	if (description.support) {
		return description.support;
	}

	if (!pendingLanguages.has(description.name)) {
		pendingLanguages.add(description.name);
		void description.load().then(() => {
			languageVersion += 1;
			for (const listener of languageListeners) {
				listener();
			}
		});
	}

	return null;
}

export function subscribeCodeLanguages(listener: () => void) {
	languageListeners.add(listener);

	return () => {
		languageListeners.delete(listener);
	};
}

export function codeLanguageVersion() {
	return languageVersion;
}
