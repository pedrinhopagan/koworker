// O prompt vai como argumento único de `claude "<texto>"` enviado por `tmux send-keys`, onde uma quebra
// de linha vira Enter e dispara o comando cedo. Achatamos toda quebra (e a indentação ao redor) num
// espaço pra manter o prompt inteiro numa string só.
export function flattenPrompt(text: string): string {
	return text.replaceAll(/\s*\n+\s*/g, " ").trim();
}

// Prompt enviado ao agente: `/kw <target>` (caminho relativo à raiz do projeto, sem o caminho da
// máquina) seguido do texto livre. O `target` já vem montado pelo chamador — é uniforme pra
// tarefa/vault/docs/skill. Sem alvo (rota que não anexa caminho), copia só o texto.
export function buildKoworkerPrompt(params: { target?: string | null; text: string }): string {
	const text = params.text.trim();

	if (!params.target) {
		return text;
	}

	const lines = [`/kw ${params.target}`];
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
