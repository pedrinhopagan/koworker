type BuiltCommand = { cmd: string; args: string[]; stdin?: string };

export function toTmuxSessionName(taskId: string): string {
	return `task-${taskId.replace(/-/g, "")}`;
}

function bashEscapeArg(value: string): string {
	return `'${value.replace(/'/g, `'\\''`)}'`;
}

function toBashCommandLine(cmd: string, args: string[]): string {
	return [cmd, ...args].map(bashEscapeArg).join(" ");
}

export function buildBashRunSnippet(built: BuiltCommand): string {
	const line = toBashCommandLine(built.cmd, built.args);
	if (built.stdin === undefined) {
		return `${line}\n`;
	}

	return `cat <<'__KOWORK_PROMPT_EOF' | ${line}\n${built.stdin}\n__KOWORK_PROMPT_EOF\n`;
}

export function buildTmuxWindowScript(built: BuiltCommand): string {
	return `${buildBashRunSnippet(built)}\nexec bash\n`;
}
