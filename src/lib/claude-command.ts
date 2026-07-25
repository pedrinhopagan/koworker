export type ClaudeCommandParams = {
	prompt: string;
	permissionMode: string;
	agent?: string;
	model?: string;
	effort?: string;
	headless?: boolean;
	sessionId?: string;
	resumeSessionId?: string;
};

function permissionArgs(permissionMode: string) {
	if (permissionMode === "bypass") {
		return ["--dangerously-skip-permissions"];
	}

	return ["--permission-mode", permissionMode];
}

export function buildClaudeArgv(params: ClaudeCommandParams): string[] {
	const argv = ["claude"];

	if (params.headless) {
		argv.push("-p");
	}

	argv.push(...permissionArgs(params.permissionMode));

	if (params.headless) {
		if (params.resumeSessionId) {
			argv.push("--resume", params.resumeSessionId);
		} else if (params.sessionId) {
			argv.push("--session-id", params.sessionId);
		}
	}

	if (params.agent) {
		argv.push("--agent", params.agent);
	}
	if (params.model) {
		argv.push("--model", params.model);
	}
	if (params.effort) {
		argv.push("--effort", params.effort);
	}

	argv.push(params.prompt);

	return argv;
}
