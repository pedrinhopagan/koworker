import { type agent_session_snapshots, db } from "./connection";

export type AgentSessionSnapshotRow = agent_session_snapshots;

export type AgentSessionSnapshotInput = {
	paneId: string;
	workspaceLabel: string;
	tabLabel: string;
	agent: string;
	cwd: string;
	projectId: string | null;
	projectName: string | null;
	status: string;
	sessionId: string | null;
	sessionPath: string | null;
	title: string | null;
	taskId: string | null;
	taskTitle: string | null;
};

function toRow(input: AgentSessionSnapshotInput, capturedAt: number) {
	return {
		id: crypto.randomUUID(),
		pane_id: input.paneId,
		workspace_label: input.workspaceLabel,
		tab_label: input.tabLabel,
		agent: input.agent,
		cwd: input.cwd,
		...(input.projectId && { project_id: input.projectId }),
		...(input.projectName && { project_name: input.projectName }),
		status: input.status,
		...(input.sessionId && { session_id: input.sessionId }),
		...(input.sessionPath && { session_path: input.sessionPath }),
		...(input.title && { title: input.title }),
		...(input.taskId && { task_id: input.taskId }),
		...(input.taskTitle && { task_title: input.taskTitle }),
		captured_at: capturedAt,
	} as agent_session_snapshots;
}

export const dbAgentSessionSnapshots = {
	list: () =>
		db
			.selectFrom("agent_session_snapshots")
			.selectAll()
			.orderBy("workspace_label", "asc")
			.orderBy("tab_label", "asc")
			.execute(),

	// O retrato é um só: gravar é trocar a lista inteira, porque agent que fechou não deve reaparecer
	// na restauração.
	replaceAll: async (inputs: AgentSessionSnapshotInput[]) => {
		const capturedAt = Date.now();

		await db.transaction().execute(async (trx) => {
			await trx.deleteFrom("agent_session_snapshots").execute();

			if (inputs.length === 0) {
				return;
			}

			await trx
				.insertInto("agent_session_snapshots")
				.values(inputs.map((input) => toRow(input, capturedAt)))
				.execute();
		});
	},

	markRestored: (ids: string[]) =>
		ids.length === 0
			? Promise.resolve()
			: db
					.updateTable("agent_session_snapshots")
					.set({ restored_at: Date.now() })
					.where("id", "in", ids)
					.execute()
					.then(() => {}),

	clear: () =>
		db
			.deleteFrom("agent_session_snapshots")
			.execute()
			.then(() => {}),
};
