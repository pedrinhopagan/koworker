// O mesmo prompt sai da barra em duas grafias: `/kw` no claude e `$kw` no codex (`/skill:kw` no pi),
// e o codex ainda reescreve a menção como link markdown para o SKILL.md. Desfazer a grafia e colapsar
// espaço é o que faz o histórico mostrar uma entrada só para o prompt mandado por CLIs diferentes.
export function normalizePrompt(text: string) {
	return text
		.replaceAll(/\[\$([a-z0-9][a-z0-9_-]*)\]\([^)]*\)/g, "/$1")
		.replaceAll(/(^|\s)\$([a-z0-9][a-z0-9_-]*)(?=\s|$)/gm, "$1/$2")
		.replaceAll(/(^|\s)\/skill:([a-z0-9][a-z0-9_-]*)(?=\s|$)/gm, "$1/$2")
		.replaceAll(/\s+/g, " ")
		.trim();
}

// Fala de usuário que o transcript registra mas ninguém digitou como prompt: comando seco, interrupção
// do claude, resumo de passagem entre modelos e imagem sem texto.
const NOISE = [
	/^\/[a-z0-9:_-]+$/i,
	/^\[Request interrupted/,
	/^Esta conversa continua uma sessão anterior/,
	/^(Imagem enviada|\d+ imagens enviadas)$/,
	/^(\[Image #\d+\]\s*)+$/,
];

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

// O texto de um bloco `user` do transcript vira prompt do histórico, ou nada. Bloco que é só marcação
// (`<task-notification>`, `<local-command-stdout>`, contexto de UI do codex) é o próprio CLI falando
// consigo; comando local (`<command-name>`) é o usuário e vira `/comando args`.
export function extractUserPrompt(raw: string): string | null {
	const text = raw.trimStart();
	if (text.startsWith("<") && !text.includes("<command-name>")) {
		return null;
	}

	const prompt = cleanUserPrompt(text);

	return !prompt || NOISE.some((pattern) => pattern.test(prompt)) ? null : prompt;
}
