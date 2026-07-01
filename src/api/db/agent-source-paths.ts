import type { AgentTool } from "../helpers/agents-fs";
import { type agent_source_paths, db } from "./connection";

export const dbAgentSourcePaths = {
	list: () =>
		db.selectFrom("agent_source_paths").selectAll().orderBy("created_at", "asc").execute(),

	create: ({ tool, path }: { tool: AgentTool; path: string }) =>
		db
			.insertInto("agent_source_paths")
			.values({
				id: crypto.randomUUID(),
				tool,
				path,
				scope: "custom",
				created_at: Date.now(),
			} as agent_source_paths)
			.executeTakeFirst(),

	// Roots default por plataforma, semeados na primeira execução com scope 'global'. O created_at
	// incremental preserva a prioridade de conteúdo (o primeiro root que tem o slug é o dono).
	seedGlobals: (roots: { tool: AgentTool; path: string }[]) => {
		const base = Date.now();

		return Promise.all(
			roots.map((root, index) =>
				db
					.insertInto("agent_source_paths")
					.values({
						id: crypto.randomUUID(),
						tool: root.tool,
						path: root.path,
						scope: "global",
						created_at: base + index,
					} as agent_source_paths)
					.executeTakeFirst(),
			),
		);
	},

	remove: (id: string) =>
		db.deleteFrom("agent_source_paths").where("id", "=", id).executeTakeFirst(),
};
