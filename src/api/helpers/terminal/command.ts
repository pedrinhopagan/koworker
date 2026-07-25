import { argvToShellCommand } from "@/lib/shell-argv";

export type TerminalCommand = { kind: "argv"; argv: string[] } | { kind: "script"; script: string };

export function terminalCommandText(command: TerminalCommand): string {
	if (command.kind === "argv") {
		return argvToShellCommand(command.argv);
	}

	return command.script;
}

export function hasTerminalCommand(command: TerminalCommand | undefined): boolean {
	if (!command) {
		return false;
	}

	if (command.kind === "argv") {
		return command.argv.length > 0;
	}

	return command.script.trim().length > 0;
}

export function buildNoneCommandArgv(
	command: TerminalCommand | undefined,
	shell: string,
): string[] {
	if (!command || !hasTerminalCommand(command)) {
		return [shell];
	}

	if (command.kind === "argv") {
		return ["/bin/sh", "-c", '"$@"; exec "$0"', shell, ...command.argv];
	}

	return [shell, "-c", `${command.script}; exec ${shell}`];
}
