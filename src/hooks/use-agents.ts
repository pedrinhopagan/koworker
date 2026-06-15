import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { orpc } from "@/client";
import type { AgentRecord, TaskAgent } from "@/types/agents";

const DEFAULT_AGENT_ICON = "Bot";
const DEFAULT_AGENT_COLOR = "#94a3b8";

function toTaskAgent(agent: AgentRecord): TaskAgent {
	const metadata = (agent.metadata ?? {}) as Record<string, unknown>;
	const metadataIcon = typeof metadata.icon === "string" ? metadata.icon : undefined;
	const metadataColor = typeof metadata.color === "string" ? metadata.color : undefined;
	const requiresSubtaskSelection =
		metadata.multiSelect === true || metadata.requiresSubtaskSelection === true;

	return {
		id: agent.slug,
		slug: agent.slug,
		label: agent.settings.label ?? agent.name,
		description: agent.description,
		instructions: agent.content,
		icon: agent.settings.icon ?? metadataIcon ?? DEFAULT_AGENT_ICON,
		color: agent.settings.color ?? metadataColor ?? DEFAULT_AGENT_COLOR,
		sources: agent.sources,
		conflict: agent.conflict,
		primaryPath: agent.primaryPath,
		primaryDir: agent.primaryDir,
		metadata,
		requiresSubtaskSelection,
	};
}

export function useAgentsQuery(projectName?: string) {
	const query = useQuery(orpc.agents.list.queryOptions({ input: { projectName } }));
	const taskAgents = useMemo(() => (query.data ?? []).map(toTaskAgent), [query.data]);

	return {
		...query,
		taskAgents,
	};
}

export function useAgentQuery(slug: string, projectName?: string, options?: { enabled?: boolean }) {
	const query = useQuery({
		...orpc.agents.get.queryOptions({ input: { slug, projectName } }),
		enabled: options?.enabled ?? true,
	});
	const agent = useMemo(() => (query.data ? toTaskAgent(query.data) : null), [query.data]);
	const variants = query.data?.variants ?? [];

	return {
		...query,
		agent,
		variants,
	};
}
