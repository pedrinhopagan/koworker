// O mesmo prompt sai da barra em duas grafias: `/kw` no claude e `$kw` no codex (`/skill:kw` no pi),
// e o codex ainda reescreve a menção como link markdown para o SKILL.md. Desfazer a grafia e colapsar
// espaço gera a chave `norm` dos registros de `prompts`, preenchida na migração do `prompt_history`.
export function normalizePrompt(text: string) {
	return text
		.replaceAll(/\[\$([a-z0-9][a-z0-9_-]*)\]\([^)]*\)/g, "/$1")
		.replaceAll(/(^|\s)\$([a-z0-9][a-z0-9_-]*)(?=\s|$)/gm, "$1/$2")
		.replaceAll(/(^|\s)\/skill:([a-z0-9][a-z0-9_-]*)(?=\s|$)/gm, "$1/$2")
		.replaceAll(/\s+/g, " ")
		.trim();
}

// O que o claude embrulha em torno de um comando local: eco do comando, saída dele e o aviso de que
// nada daquilo foi digitado pelo usuário. Como marcação, não como frase.
const LOCAL_COMMAND_TAGS =
	/<(command-message|command-args|command-contents|local-command-stdout|local-command-stderr|local-command-caveat)>[\s\S]*?<\/\1>/g;
const COMMAND_NAME_TAG = /<command-name>([\s\S]*?)<\/command-name>/;

export function cleanUserPrompt(text: string) {
	const command = COMMAND_NAME_TAG.exec(text)?.[1]?.trim();
	const rest = text
		.replaceAll(LOCAL_COMMAND_TAGS, "")
		.replace(COMMAND_NAME_TAG, "")
		.replaceAll(/<\/?[a-z-]+>/gi, "")
		.trim();

	return [command, rest].filter(Boolean).join(" ").trim();
}
