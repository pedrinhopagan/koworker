import { mkdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	ensureKwTerminalServer,
	findTabByLabel,
	findWorkspaceByLabel,
	kwTerminalPaneRun,
	kwTerminalTabClose,
	kwTerminalTabCreate,
	kwTerminalTabList,
	kwTerminalWorkspaceCreate,
} from "./terminal/kw-terminal";
import { windowNameForTask } from "./terminal/names";

export const EXECUTION_WORKSPACE_LABEL = "kw_execucoes";

const RUN_FILES_DIR = join(tmpdir(), "kowork-executions");

function shellQuote(value: string) {
	return `'${value.replaceAll("'", `'\\''`)}'`;
}

export type ExecutionTerminalHandle = {
	logPath: string;
	exitPath: string;
	tabId: string;
	closeTab(): Promise<void>;
	tabAlive(): Promise<boolean>;
	cleanup(): Promise<void>;
};

export async function openExecutionTerminal(params: {
	runId: string;
	title: string;
	cwd: string;
	cmd: string[];
}): Promise<ExecutionTerminalHandle> {
	await ensureKwTerminalServer();

	const workspace =
		(await findWorkspaceByLabel(EXECUTION_WORKSPACE_LABEL)) ??
		(await kwTerminalWorkspaceCreate({
			cwd: params.cwd,
			label: EXECUTION_WORKSPACE_LABEL,
			focus: false,
		}));

	await mkdir(RUN_FILES_DIR, { recursive: true });
	const logPath = join(RUN_FILES_DIR, `${params.runId}.log`);
	const exitPath = join(RUN_FILES_DIR, `${params.runId}.exit`);
	const scriptPath = join(RUN_FILES_DIR, `${params.runId}.sh`);
	await Bun.write(
		scriptPath,
		[
			"#!/usr/bin/env bash",
			"set -o pipefail",
			`cd ${shellQuote(params.cwd)} || exit 1`,
			`${params.cmd.map(shellQuote).join(" ")} 2>&1 | tee ${shellQuote(logPath)}`,
			`echo $? > ${shellQuote(exitPath)}`,
		].join("\n"),
	);

	const label = windowNameForTask(params.runId, params.title);
	const existing = await findTabByLabel(workspace.workspace_id, label);
	if (existing) {
		await kwTerminalTabClose(existing.tab_id);
	}

	const { tab, rootPane } = await kwTerminalTabCreate({
		workspaceId: workspace.workspace_id,
		cwd: params.cwd,
		label,
		focus: false,
	});
	await kwTerminalPaneRun(rootPane.pane_id, `bash ${shellQuote(scriptPath)}`);

	return {
		logPath,
		exitPath,
		tabId: tab.tab_id,
		closeTab: async () => {
			await kwTerminalTabClose(tab.tab_id).catch(() => false);
		},
		tabAlive: async () => {
			const tabs = await kwTerminalTabList(workspace.workspace_id).catch(() => []);
			return tabs.some((candidate) => candidate.tab_id === tab.tab_id);
		},
		cleanup: async () => {
			await Promise.all([
				rm(scriptPath, { force: true }),
				rm(logPath, { force: true }),
				rm(exitPath, { force: true }),
			]);
		},
	};
}

export async function readNewLogBytes(params: {
	path: string;
	offset: number;
	decoder: TextDecoder;
}): Promise<{ text: string; next: number }> {
	const stats = await stat(params.path).catch(() => null);
	if (!stats || stats.size <= params.offset) {
		return { text: "", next: params.offset };
	}

	const bytes = await Bun.file(params.path).slice(params.offset, stats.size).arrayBuffer();

	return {
		text: params.decoder.decode(bytes, { stream: true }),
		next: stats.size,
	};
}
