import { spawnEnv } from "@/api/helpers/spawn";
import { argvToShellCommand } from "@/lib/shell-argv";

const TITLE_PLACEHOLDER = "{title}";
const COMMAND_PLACEHOLDER = "{command}";

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

function escapeAppleScriptString(value: string): string {
	return value
		.replaceAll("\\", "\\\\")
		.replaceAll('"', '\\"')
		.replaceAll("\n", "\\n")
		.replaceAll("\r", "\\r")
		.replaceAll("\t", "\\t");
}

function substitutePlaceholders(params: {
	token: string;
	title: string;
	commandArgv: string[];
	isAppleScript: boolean;
}): string {
	const { token, title, commandArgv, isAppleScript } = params;
	const shellCommand = argvToShellCommand(commandArgv);

	let value = "";
	let insideDoubleQuotes = false;
	let index = 0;

	while (index < token.length) {
		if (token.startsWith(COMMAND_PLACEHOLDER, index)) {
			if (insideDoubleQuotes && !isAppleScript) {
				throw new Error(
					"Template de terminal inválido: {command} dentro de aspas duplas só é suportado em templates osascript (AppleScript). Tire as aspas do placeholder ou escolha outro preset.",
				);
			}

			value += insideDoubleQuotes ? escapeAppleScriptString(shellCommand) : shellCommand;
			index += COMMAND_PLACEHOLDER.length;
			continue;
		}

		if (token.startsWith(TITLE_PLACEHOLDER, index)) {
			value += insideDoubleQuotes && isAppleScript ? escapeAppleScriptString(title) : title;
			index += TITLE_PLACEHOLDER.length;
			continue;
		}

		const char = token[index] ?? "";
		if (char === '"') {
			insideDoubleQuotes = !insideDoubleQuotes;
		}

		value += char;
		index += 1;
	}

	return value;
}

export function buildEmulatorArgv(params: {
	template: string;
	title: string;
	commandArgv: string[];
}): string[] {
	const { title, commandArgv } = params;
	const tokens = tokenizeTemplate(params.template);
	const isAppleScript = tokens[0]?.split("/").at(-1) === "osascript";
	const argv: string[] = [];

	for (const token of tokens) {
		if (token === TITLE_PLACEHOLDER) {
			argv.push(title);
			continue;
		}
		if (token === COMMAND_PLACEHOLDER) {
			argv.push(...commandArgv);
			continue;
		}

		argv.push(substitutePlaceholders({ token, title, commandArgv, isAppleScript }));
	}

	return argv;
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
		env: spawnEnv(),
	});
}

export type EmulatorProcess = ReturnType<typeof spawnEmulator>;
