// Labels estáveis entre reinícios: sessões criadas por versões anteriores (ou por outra execução
// do backend) sobrevivem ao restart e continuam sendo encontradas pelo mesmo nome.

// Alfanumérico Unicode, como o `char::is_alphanumeric` do Rust (letras + números de qualquer script).
const WORD_CHAR = /[\p{L}\p{N}]/u;

// `kw_<slug>`: o slug é a primeira palavra do nome do projeto, só com alfanuméricos/`-`/`_`, minúscula.
// Vazio (nome só com símbolos ou em branco) cai em `projeto`.
export function sessionNameForProject(projectName: string): string {
	const firstToken = projectName.split(/\s+/).find((part) => part.length > 0) ?? "projeto";
	const slug = [...firstToken]
		.filter((ch) => WORD_CHAR.test(ch) || ch === "-" || ch === "_")
		.join("")
		.toLowerCase();

	return `kw_${slug || "projeto"}`;
}

// `<id8>_<titulo>`: os 8 primeiros chars do id da task como prefixo estável + o título sanitizado
// (alfanumérico/espaço/`-`/`_`, 20 chars, espaços viram `_`, minúsculo). Título vazio → só o id8.
export function windowNameForTask(taskId: string, taskTitle: string): string {
	const shortId = taskId.length >= 8 ? taskId.slice(0, 8) : taskId;
	const sanitized = [...taskTitle]
		.filter((ch) => WORD_CHAR.test(ch) || ch === " " || ch === "-" || ch === "_")
		.slice(0, 20)
		.join("")
		.trim()
		.replaceAll(" ", "_")
		.toLowerCase();

	return sanitized === "" ? shortId : `${shortId}_${sanitized}`;
}

// Window de uma rota: nome minúsculo com espaços virando `_` e só alfanuméricos/`_` (sem `-`).
export function sanitizeRouteName(routeName: string): string {
	return [...routeName.toLowerCase().replaceAll(" ", "_")]
		.filter((ch) => WORD_CHAR.test(ch) || ch === "_")
		.join("");
}

// Tab da sessão livre aberta pela rota /terminals. Prefixo próprio para não ser lida como invocação
// (`agent_`/`skill_`) nem como tarefa; sem nome informado o rótulo cai na hora da abertura.
export function sessionTabName(label?: string): string {
	const sanitized = label ? sanitizeRouteName(label).slice(0, 20) : "";

	if (sanitized) {
		return `sess_${sanitized}`;
	}

	const now = new Date();
	const hours = String(now.getHours()).padStart(2, "0");
	const minutes = String(now.getMinutes()).padStart(2, "0");

	return `sess_${hours}${minutes}`;
}

// Discrimina a window de uma invocação de agent/skill. O taskId da invocação é `agent_<slug>` /
// `skill_<slug>` (ver `src/lib/invoke.ts`) e `windowNameForTask` o trunca em 8 chars como prefixo,
// então a window sempre começa com `agent_` / `skill_`. Tarefas (UUID hex) e rotas (nome sanitizado)
// nunca colidem com esses prefixos.
export function isInvocationWindow(windowName: string): boolean {
	return windowName.startsWith("agent_") || windowName.startsWith("skill_");
}
