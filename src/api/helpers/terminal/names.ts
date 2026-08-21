// Labels estáveis entre reinícios: sessões criadas por versões anteriores (ou por outra execução
// do backend) sobrevivem ao restart e continuam sendo encontradas pelo mesmo nome.

// Alfanumérico Unicode, como o `char::is_alphanumeric` do Rust (letras + números de qualquer script).
const WORD_CHAR = /[\p{L}\p{N}]/u;

// Workspace de tudo que roda fora de um projeto cadastrado (conversa antiga retomada de uma pasta
// que nenhum projeto cobre). O grupo é sempre um projeto ou este; nunca o nome da pasta, que faria o
// kw-terminal ganhar um grupo `kw_pedro` por ter rodado em `~`.
export const NO_PROJECT_SESSION_NAME = "kw_sem-projeto";

// `kw_<slug>`: o slug usa o nome inteiro do projeto, só com alfanuméricos/`-`/`_`, minúscula.
// Separadores viram `-`; vazio (nome só com símbolos ou em branco) cai em `projeto`.
export function sessionNameForProject(projectName: string): string {
	const slug = projectName
		.trim()
		.split(/[^\p{L}\p{N}_-]+/u)
		.filter((part) => part.length > 0)
		.join("-")
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
	// 40 em vez de 20: rótulos de retomada carregam o id curto da conversa, e cortar no meio dele
	// devolvia a colisão que o id existia para evitar.
	const sanitized = label ? sanitizeRouteName(label).slice(0, 40) : "";

	if (sanitized) {
		return `sess_${sanitized}`;
	}

	const now = new Date();
	const hours = String(now.getHours()).padStart(2, "0");
	const minutes = String(now.getMinutes()).padStart(2, "0");

	return `sess_${hours}${minutes}`;
}

// Slug de nome próprio (agent, skill): mantém `-`, que é o separador que os slugs do disco usam.
function sanitizeSlug(slug: string): string {
	return [...slug.toLowerCase().replaceAll(" ", "_")]
		.filter((ch) => WORD_CHAR.test(ch) || ch === "_" || ch === "-")
		.join("")
		.slice(0, 20);
}

// Invocação de agent/skill: `agent_<slug>` / `skill_<slug>`, os prefixos que `isInvocationWindow`
// reconhece para contar e varrer só essas tabs.
export function invocationTabName(invoked: "agent" | "skill", slug: string): string {
	return `${invoked}_${sanitizeSlug(slug) || "sem-nome"}`;
}

// Discrimina a window de uma invocação de agent/skill. Tarefas (`<id8>_<titulo>`, com id hex),
// rotas (nome sanitizado), a tab do CLI (`cli_`) e a sessão livre (`sess_`) nunca colidem com esses
// prefixos.
export function isInvocationWindow(windowName: string): boolean {
	return windowName.startsWith("agent_") || windowName.startsWith("skill_");
}

// O alvo de uma abertura de terminal, do qual sai o rótulo da tab. Todo caminho que abre ou foca
// terminal descreve o alvo aqui em vez de montar o rótulo por conta: é o que garante que a mesma
// tarefa, rota ou CLI caia sempre na mesma tab, seja qual for a tela que disparou a ação.
export type TerminalTabTarget =
	| { kind: "task"; taskId: string; title: string }
	| { kind: "run"; runId: string; title: string }
	| { kind: "route"; name: string }
	| { kind: "cli"; cli: string }
	| { kind: "invocation"; invoked: "agent" | "skill"; slug: string }
	| { kind: "session"; label?: string };

export function terminalTabLabel(target: TerminalTabTarget): string {
	switch (target.kind) {
		case "task":
			return windowNameForTask(target.taskId, target.title);
		case "run":
			return windowNameForTask(target.runId, target.title);
		case "route":
			return sanitizeRouteName(target.name);
		case "cli":
			return `cli_${target.cli}`;
		case "invocation":
			return invocationTabName(target.invoked, target.slug);
		case "session":
			return sessionTabName(target.label);
	}
}
