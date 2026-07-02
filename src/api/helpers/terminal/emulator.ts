// Abre a janela do emulador a partir do template configurado (Fatia 1). O template é uma linha de
// comando com os placeholders `{title}` e `{command}` — ex.: `alacritty --title {title} -e {command}`.
// `{title}` vira UM argumento (preserva espaços); `{command}` standalone expande para a argv do
// comando a rodar; embutido numa string (ex.: osascript) é substituído como texto.

// Tokeniza o template respeitando aspas simples/duplas (como o shell), pra que um preset com string
// citada — `osascript -e 'tell ... "{command}"'` — vire um único token em vez de quebrar nos espaços.
export function tokenizeTemplate(template: string): string[] {
	const tokens: string[] = [];
	let current = "";
	let started = false;
	let quote: '"' | "'" | null = null;

	for (const ch of template) {
		if (quote) {
			if (ch === quote) {
				quote = null;
			} else {
				current += ch;
			}
			continue;
		}
		if (ch === '"' || ch === "'") {
			quote = ch;
			started = true;
			continue;
		}
		if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
			if (started) {
				tokens.push(current);
				current = "";
				started = false;
			}
			continue;
		}
		current += ch;
		started = true;
	}
	if (started) {
		tokens.push(current);
	}

	return tokens;
}

export function buildEmulatorArgv(params: {
	template: string;
	title: string;
	commandArgv: string[];
}): string[] {
	const { title, commandArgv } = params;
	const argv: string[] = [];

	for (const token of tokenizeTemplate(params.template)) {
		if (token === "{title}") {
			argv.push(title);
			continue;
		}
		if (token === "{command}") {
			argv.push(...commandArgv);
			continue;
		}

		let value = token.replaceAll("{title}", title);
		if (value.includes("{command}")) {
			value = value.replaceAll("{command}", commandArgv.join(" "));
		}
		argv.push(value);
	}

	return argv;
}

// A argv que o `{command}` do template representa no modo `none`: roda o comando num shell e mantém o
// shell aberto depois (`exec`), pra a janela não fechar ao terminar. Sem comando, só abre o shell
// interativo na pasta de trabalho.
export function buildNoneCommandArgv(command: string | undefined, shell: string): string[] {
	if (command && command.trim().length > 0) {
		return [shell, "-c", `${command}; exec ${shell}`];
	}

	return [shell];
}

export function spawnEmulator(params: {
	template: string;
	title: string;
	commandArgv: string[];
	cwd: string;
}) {
	const argv = buildEmulatorArgv(params);

	return Bun.spawn(argv, {
		cwd: params.cwd,
		stdout: "ignore",
		stderr: "ignore",
		stdin: "ignore",
	});
}

export type EmulatorProcess = ReturnType<typeof spawnEmulator>;
