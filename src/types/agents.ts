import type { RouterOutputs } from "@/client";

export type AgentRecord = RouterOutputs["agents"]["list"][number];
export type AgentSource = AgentRecord["sources"][number];
export type AgentDetail = NonNullable<RouterOutputs["agents"]["get"]>;
export type AgentVariant = AgentDetail["variants"][number];
export type AgentSourcePath = RouterOutputs["agents"]["listPaths"][number];

export type TaskAgent = {
	id: string;
	slug: string;
	label: string;
	description: string;
	instructions: string;
	icon: string;
	color: string;
	sources: AgentSource[];
	conflict: boolean;
	primaryPath: string;
	primaryDir: string;
	metadata: Record<string, unknown>;
	requiresSubtaskSelection: boolean;
};
