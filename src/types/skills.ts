import type { RouterOutputs } from "@/client";

export type SkillRecord = RouterOutputs["skills"]["list"][number];
export type SkillSource = SkillRecord["sources"][number];
export type SkillDetail = NonNullable<RouterOutputs["skills"]["get"]>;
export type SkillVariant = SkillDetail["variants"][number];
export type SkillSourcePath = RouterOutputs["skills"]["listPaths"][number];

export type TaskSkill = {
	id: string;
	slug: string;
	label: string;
	description: string;
	instructions: string;
	icon: string;
	color: string;
	source: "builtin" | "custom";
	sources: SkillSource[];
	conflict: boolean;
	primaryPath: string;
	primaryDir: string;
	metadata: Record<string, unknown>;
	requiresSubtaskSelection: boolean;
};
