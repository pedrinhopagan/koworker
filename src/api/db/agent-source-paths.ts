import type { AgentTool } from "../helpers/agents-fs";
import { type agent_source_paths, db } from "./connection";

export const dbAgentSourcePaths = {
	list: () =>
		db.selectFrom("agent_source_paths").selectAll().orderBy("created_at", "asc").execute(),

	create: ({ tool, path }: { tool: AgentTool; path: string }) =>
		db
			.insertInto("agent_source_paths")
			.values({ id: crypto.randomUUID(), tool, path, created_at: Date.now() } as agent_source_paths)
			.executeTakeFirst(),

	remove: (id: string) =>
		db.deleteFrom("agent_source_paths").where("id", "=", id).executeTakeFirst(),
};
