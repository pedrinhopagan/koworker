import type { WorkingCli } from "@/constants/invoke";
import { mediaRelativePath } from "@/constants/koworker";

export type PromptCopyCli = WorkingCli;

// Marcador de imagem colada no textarea — o que o usuário vê e move livremente pelo texto. Na
// composição do prompt ele vira `@.koworker/medias/<arquivo>`: a mention de arquivo que o claude
// code anexa como imagem de verdade, no exato ponto do texto onde o marcador estava.
export function imagePlaceholder(index: number): string {
	return `[Imagem ${index}]`;
}

export function nextImageIndex(images: { index: number }[]): number {
	return images.reduce((max, image) => Math.max(max, image.index), 0) + 1;
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

// Skills usam `/slug` no Claude, `$slug` no Codex e `/skill:slug` no Pi. Só casa `/` em início de
// palavra seguido de um slug terminado em fronteira — caminhos como `/mnt/data` passam retos.
export function convertSkillCallsForCli(text: string, cli: PromptCopyCli): string {
	if (cli === "claude") {
		return text;
	}
	return text.replaceAll(
		/(^|\s)\/([a-z0-9][a-z0-9_-]*)(?=\s|$)/gm,
		cli === "codex" ? "$1$$$2" : "$1/skill:$2",
	);
}

// O prompt vai como argumento único de `claude "<texto>"` digitado no pane do terminal, onde uma
// quebra de linha vira Enter e dispara o comando cedo. Achatamos toda quebra (e a indentação ao redor) num
// espaço pra manter o prompt inteiro numa string só.
export function flattenPrompt(text: string): string {
	return text.replaceAll(/\s*\n+\s*/g, " ").trim();
}

export function buildKoworkerPrompt(params: {
	kw: boolean;
	target?: string | null;
	text: string;
}): string {
	const text = params.text.trim();
	const head = [params.kw ? "/kw" : null, params.target].filter(Boolean).join(" ");

	if (!head) {
		return text;
	}

	const lines = [head];
	if (text) {
		lines.push("", text);
	}

	return lines.join("\n");
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
