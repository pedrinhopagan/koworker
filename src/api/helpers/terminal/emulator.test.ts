import { expect, test } from "bun:test";

import { TERMINAL_PRESETS } from "@/constants/terminal";
import { argvToShellCommand } from "@/lib/shell-argv";
import { buildNoneCommandArgv } from "./command";
import { buildEmulatorArgv, tokenizeTemplate } from "./emulator";

test("tokenizeTemplate: quebra por espaços preservando strings citadas", () => {
	expect(tokenizeTemplate(TERMINAL_PRESETS.alacritty.template)).toEqual([
		"alacritty",
		"--title",
		"{title}",
		"-e",
		"{command}",
	]);

	expect(tokenizeTemplate(TERMINAL_PRESETS["macos-terminal"].template)).toEqual([
		"osascript",
		"-e",
		'tell application "Terminal" to do script "{command}"',
	]);
});

test("buildEmulatorArgv: {title} é um argumento e {command} expande a argv", () => {
	expect(
		buildEmulatorArgv({
			template: TERMINAL_PRESETS.alacritty.template,
			title: "Foo - Kowork",
			commandArgv: ["tmux", "attach-session", "-t", "kw_foo"],
		}),
	).toEqual([
		"alacritty",
		"--title",
		"Foo - Kowork",
		"-e",
		"tmux",
		"attach-session",
		"-t",
		"kw_foo",
	]);
});

test("buildEmulatorArgv: placeholder embutido num token é substituído como texto", () => {
	expect(
		buildEmulatorArgv({
			template: TERMINAL_PRESETS.konsole.template,
			title: "Foo - Kowork",
			commandArgv: ["fish"],
		}),
	).toEqual(["konsole", "-p", "tabtitle=Foo - Kowork", "-e", "fish"]);
});

function parseAppleScriptDoScript(source: string): string {
	const prefix = 'tell application "Terminal" to do script "';
	expect(source.startsWith(prefix)).toBe(true);

	let value = "";
	let index = prefix.length;

	while (index < source.length) {
		const char = source[index];
		if (char === "\\") {
			const escaped = source[index + 1];
			expect(escaped).toBeDefined();
			value += escaped === "n" ? "\n" : escaped;
			index += 2;
			continue;
		}
		if (char === '"') {
			expect(source.slice(index)).toBe('"');
			return value;
		}

		value += char;
		index += 1;
	}

	throw new Error("string AppleScript não fechada");
}

const APPLESCRIPT_PAYLOADS = [
	'diga "oi"',
	'" & (do shell script "touch /tmp/kw-pwned") & "',
	"rode $(rm -rf /)",
	"rode `rm -rf /`",
	"linha um\nlinha dois",
];

for (const payload of APPLESCRIPT_PAYLOADS) {
	test(`buildEmulatorArgv: preset osascript não deixa o prompt escapar da string AppleScript (${JSON.stringify(payload)})`, () => {
		const commandArgv = buildNoneCommandArgv(
			{ kind: "argv", argv: ["claude", payload] },
			"/bin/fish",
		);

		const argv = buildEmulatorArgv({
			template: TERMINAL_PRESETS["macos-terminal"].template,
			title: "Foo - Kowork",
			commandArgv,
		});

		expect(argv.slice(0, 2)).toEqual(["osascript", "-e"]);
		expect(argv).toHaveLength(3);
		expect(parseAppleScriptDoScript(argv[2] ?? "")).toBe(argvToShellCommand(commandArgv));
	});
}

for (const payload of APPLESCRIPT_PAYLOADS) {
	test(`buildEmulatorArgv: o shell aberto pelo osascript recebe o prompt como argumento único (${JSON.stringify(payload)})`, async () => {
		const argv = buildEmulatorArgv({
			template: TERMINAL_PRESETS["macos-terminal"].template,
			title: "Foo - Kowork",
			commandArgv: ["printf", "%s", payload],
		});

		const shell = Bun.spawn(["/bin/sh", "-c", parseAppleScriptDoScript(argv[2] ?? "")], {
			stdin: "ignore",
			stdout: "pipe",
			stderr: "ignore",
		});

		expect(await new Response(shell.stdout).text()).toBe(payload);
	});
}

test("buildEmulatorArgv: {command} entre aspas duplas fora do AppleScript é rejeitado", () => {
	expect(() =>
		buildEmulatorArgv({
			template: `foo -e 'bar "{command}"'`,
			title: "Foo - Kowork",
			commandArgv: ["claude", "oi"],
		}),
	).toThrow("Template de terminal inválido");
});
