export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch (error) {
		console.error("[Clipboard] Erro ao copiar:", error);

		try {
			const textArea = document.createElement("textarea");
			textArea.value = text;
			textArea.style.position = "fixed";
			textArea.style.left = "-999999px";
			textArea.style.top = "-999999px";
			document.body.append(textArea);
			textArea.focus();
			textArea.select();
			const success = document.execCommand("copy");
			textArea.remove();
			return success;
		} catch (fallbackError) {
			console.error("[Clipboard] Fallback tambem falhou:", fallbackError);
			return false;
		}
	}
}
