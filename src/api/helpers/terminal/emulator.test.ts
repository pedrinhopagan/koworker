import { expect, test } from "bun:test";

import { TERMINAL_PRESETS } from "@/constants/terminal";
import { buildEmulatorArgv, buildNoneCommandArgv, tokenizeTemplate } from "./emulator";

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

test("buildNoneCommandArgv: mantém o shell aberto após o comando; sem comando abre o shell", () => {
	expect(buildNoneCommandArgv("claude x", "/bin/fish")).toEqual([
		"/bin/fish",
		"-c",
		"claude x; exec /bin/fish",
	]);
	expect(buildNoneCommandArgv(undefined, "/bin/sh")).toEqual(["/bin/sh"]);
	expect(buildNoneCommandArgv("   ", "/bin/sh")).toEqual(["/bin/sh"]);
});
