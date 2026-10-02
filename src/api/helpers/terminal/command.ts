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
