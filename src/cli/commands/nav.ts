import { KwTerminalNavigateSchema } from "@/api/schemas/kw-terminal";
import { postToServer } from "../notify";

export async function runNav(args: string[]): Promise<void> {
	const parsed = KwTerminalNavigateSchema.safeParse({ route: args[0] ?? "" });
	if (!parsed.success) {
		throw new Error(
			"Uso: kw-cli nav <rota>, com rota interna absoluta (ex: /tarefas/<feature>/<task>)",
		);
	}

	// Sem app aberto não há para onde navegar, e o silêncio faria o clique no
	// kw-terminal parecer bem-sucedido.
	if ((await postToServer("/api/kw-terminal/navigate", parsed.data)) === 0) {
		throw new Error("Koworker não está respondendo; abra o app e tente de novo.");
	}
}
