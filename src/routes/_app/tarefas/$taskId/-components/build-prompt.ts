// Prompt enviado ao agente: `/koworker` + o caminho do `.md` em foco, relativo à raiz do
// projeto (sem o caminho da máquina). O agente resolve dentro do projeto atual e lê a pasta
// inteira; o conteúdo dos `.md` não vai no prompt.
export function buildKoworkerPrompt(params: {
	folderPath: string;
	fileName?: string;
	userInput?: string;
}): string {
	const target = params.fileName
		? `/${params.folderPath}/${params.fileName}`
		: `/${params.folderPath}`;
	const lines = ["/koworker", target];

	const extra = params.userInput?.trim();
	if (extra) {
		lines.push("", extra);
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
