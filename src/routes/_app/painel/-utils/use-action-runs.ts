import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { orpc, type RouterOutputs } from "@/client";
import type { CallChipState } from "@/components/ui/call-chip";
import { toast } from "@/components/ui/toast";
import type { ProjectActionMode } from "@/constants/project-actions";

export type ProjectAction = RouterOutputs["projectActions"]["list"]["actions"][number];

export type ActionRun = {
	id: string;
	actionId: string;
	label: string;
	command?: string;
	startedAt: number;
	state: CallChipState;
	output?: string;
};

export function useActionRuns(projectId: string) {
	const queryClient = useQueryClient();
	const [runs, setRuns] = useState<ActionRun[]>([]);

	function patchRun(id: string, patch: Partial<ActionRun>) {
		setRuns((previous) => previous.map((run) => (run.id === id ? { ...run, ...patch } : run)));
	}

	async function openInTerminal(action: ProjectAction) {
		try {
			await orpc.projectActions.run.call({ projectId, actionId: action.id, mode: "terminal" });
			toast.success(`Terminal aberto: ${action.label}`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Não foi possível abrir o terminal");
		}
	}

	async function runInBackground(action: ProjectAction) {
		const id = crypto.randomUUID();
		const startedAt = Date.now();
		setRuns((previous) => [
			{
				id,
				actionId: action.id,
				label: action.label,
				command: action.command,
				startedAt,
				state: { status: "running", startedAt },
			},
			...previous,
		]);

		try {
			const result = await orpc.projectActions.run.call({
				projectId,
				actionId: action.id,
				mode: "background",
			});
			if (result.mode !== "background") return;
			patchRun(id, {
				output: result.output,
				state: {
					status: result.ok ? "done" : "failed",
					durationMs: result.durationMs,
					exitCode: result.exitCode,
					timedOut: result.timedOut,
				},
			});
		} catch (error) {
			patchRun(id, {
				output: error instanceof Error ? error.message : String(error),
				state: { status: "failed", durationMs: Date.now() - startedAt },
			});
		} finally {
			queryClient.invalidateQueries({
				queryKey: orpc.projectActions.list.queryOptions({ input: { projectId } }).queryKey,
			});
		}
	}

	function run(action: ProjectAction, mode: ProjectActionMode) {
		return mode === "terminal" ? openInTerminal(action) : runInBackground(action);
	}

	function latestFor(actionId: string) {
		return runs.find((item) => item.actionId === actionId);
	}

	return { runs, run, latestFor, clear: () => setRuns([]) };
}
