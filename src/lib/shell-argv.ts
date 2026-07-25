const SAFE_ARG = /^[A-Za-z0-9_@%+=:,./-]+$/;

export function shellQuote(value: string): string {
	if (SAFE_ARG.test(value)) {
		return value;
	}

	return `'${value.replaceAll("'", "'\\''")}'`;
}

export function argvToShellCommand(argv: string[]): string {
	return argv.map(shellQuote).join(" ");
}
