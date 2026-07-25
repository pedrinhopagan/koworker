export type CodexCommandParams = {
	prompt: string;
	approvalMode: string;
	model?: string;
	effort?: string;
	headless?: boolean;
	persistSession?: boolean;
	structuredOutput?: boolean;
	resumeSessionId?: string;
};

function approvalArgs(approvalMode: string, resume = false) {
	if (approvalMode === "bypass") {
		return ["--dangerously-bypass-approvals-and-sandbox"];
	}
	if (approvalMode === "fullAuto") {
		if (resume) {
			return ["-c", 'approval_policy="never"', "-c", 'sandbox_mode="workspace-write"'];
		}
		return ["--full-auto"];
	}
	if (approvalMode === "readOnly") {
		if (resume) {
			return ["-c", 'sandbox_mode="read-only"'];
		}
		return ["--sandbox", "read-only"];
	}
	return [];
}

export function buildCodexExecArgs(params: CodexCommandParams & { cwd?: string }) {
	const args = params.resumeSessionId ? ["codex", "exec", "resume"] : ["codex", "exec"];

	if (params.model) {
		args.push("-m", params.model);
	}
	if (params.effort) {
		args.push("-c", `model_reasoning_effort=${params.effort}`);
	}

	if (!params.persistSession && !params.resumeSessionId) {
		args.push("--ephemeral");
	}
	args.push("--skip-git-repo-check");
	if (params.cwd && !params.resumeSessionId) {
		args.push("-C", params.cwd);
	}
	args.push(...approvalArgs(params.approvalMode, !!params.resumeSessionId));
	if (params.structuredOutput) {
		args.push("--json");
	}
	if (params.resumeSessionId) {
		args.push(params.resumeSessionId);
	}
	args.push(params.prompt);
	return args;
}

export function buildCodexArgv(params: CodexCommandParams & { cwd?: string }): string[] {
	if (params.headless) {
		return buildCodexExecArgs(params);
	}

	const argv = ["codex", ...approvalArgs(params.approvalMode)];

	if (params.model) {
		argv.push("-m", params.model);
	}
	if (params.effort) {
		argv.push("-c", `model_reasoning_effort=${params.effort}`);
	}

	argv.push(params.prompt);

	return argv;
}
