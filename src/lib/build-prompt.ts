import type { TaskComplexity } from "@/constants/complexity";
import type { InvokeCli } from "@/constants/invoke";
import { mediaRelativePath } from "@/constants/koworker";
import { PROMPT_TEMPLATES } from "@/constants/prompt-templates";

// Marcador de imagem colada no textarea — o que o usuário vê e move livremente pelo texto. Na
// composição do prompt ele vira `@.koworker/medias/<arquivo>`: a mention de arquivo que o claude
// code anexa como imagem de verdade, no exato ponto do texto onde o marcador estava.
export function imagePlaceholder(index: number): string {
	return `[Imagem ${index}]`;
}

export function resolveImagePlaceholders(
	text: string,
	images: { index: number; name: string }[],
): string {
	return images.reduce(
		(acc, image) =>
			acc.replaceAll(imagePlaceholder(image.index), `@${mediaRelativePath(image.name)}`),
		text,
	);
}

// No codex, skills são custom prompts invocados com `$slug` — converte toda chamada `/slug` do prompt
// (inclusive o `/kw` da cabeça e as digitadas com `/` no texto) pro prefixo `$`. Só casa `/` em início
// de palavra seguido de um slug terminado em fronteira — caminhos como `/mnt/data` têm outra `/` logo
// depois e passam retos. No claude o texto passa intacto.
export function convertSkillCallsForCli(text: string, cli: InvokeCli): string {
	if (cli !== "codex") {
		return text;
	}
	return text.replaceAll(/(^|\s)\/([a-z0-9][a-z0-9_-]*)(?=\s|$)/gm, "$1$$$2");
}

// O prompt vai como argumento único de `claude "<texto>"` enviado por `tmux send-keys`, onde uma quebra
// de linha vira Enter e dispara o comando cedo. Achatamos toda quebra (e a indentação ao redor) num
// espaço pra manter o prompt inteiro numa string só.
export function flattenPrompt(text: string): string {
	return text.replaceAll(/\s*\n+\s*/g, " ").trim();
}

// Prompt enviado ao agente: `/kw <target> [complexidade: <valor>]` (caminho relativo à raiz do
// projeto, sem o caminho da máquina) seguido do texto livre. `kw` decide se a skill `/kw` entra na
// cabeça; `target` já vem montado pelo chamador. A complexidade só acompanha o `/kw` (é um conceito
// da skill de fluxo) e traz o dado sem o agente reler o banco. Cabeça vazia copia só o texto.
export function buildKoworkerPrompt(params: {
	kw: boolean;
	target?: string | null;
	text: string;
	complexity?: TaskComplexity;
}): string {
	const text = params.text.trim();
	const complexityTag =
		params.kw && params.complexity ? `[complexidade: ${params.complexity}]` : null;
	const head = [params.kw ? "/kw" : null, params.target, complexityTag].filter(Boolean).join(" ");

	if (!head) {
		return text;
	}

	const lines = [head];
	if (text) {
		lines.push("", text);
	}

	return lines.join("\n");
}

// Corpo do prompt: os campos preenchidos do template ativo ("Label: valor", um por linha) seguidos do
// texto livre. Campos vazios não entram; sem template (ou tudo vazio), o corpo é só o texto. Com
// `images`, os marcadores `[Imagem N]` do corpo inteiro viram paths de mídia.
export function buildPromptBody(params: {
	templateSlug: string | null;
	values: Record<string, Record<string, string>>;
	text: string;
	images?: { index: number; name: string }[];
}): string {
	const template = PROMPT_TEMPLATES.find((entry) => entry.slug === params.templateSlug);
	const structure = template
		? template.fields
				.map((field) => {
					const value = (params.values[template.slug]?.[field.key] ?? "").trim();
					return value ? `${field.label}: ${value}` : null;
				})
				.filter(Boolean)
				.join("\n")
		: "";

	const body = [structure, params.text.trim()].filter(Boolean).join("\n\n");

	return params.images?.length ? resolveImagePlaceholders(body, params.images) : body;
}

export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		const textArea = document.createElement("textarea");
		textArea.value = text;
		textArea.style.position = "fixed";
		textArea.style.left = "-999999px";
		document.body.append(textArea);
		textArea.focus();
		textArea.select();
		const success = document.execCommand("copy");
		textArea.remove();
		return success;
	}
}
