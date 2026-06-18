import type { RouterOutputs } from "@/client";

export type SkillRecord = RouterOutputs["skills"]["list"][number];
export type SkillSource = SkillRecord["sources"][number];
export type SkillDetail = NonNullable<RouterOutputs["skills"]["get"]>;
export type SkillVariant = SkillDetail["variants"][number];
export type SkillSourcePath = RouterOutputs["skills"]["listPaths"][number];
export type SkillCategory = RouterOutputs["skillCategories"]["list"][number];

export type TaskSkill = {
	id: string;
	slug: string;
	label: string;
	description: string;
	instructions: string;
	icon: string;
	color: string;
	categoryId: string | null;
	quickInvoke: boolean;
	sources: SkillSource[];
	conflict: boolean;
	primaryPath: string;
	primaryDir: string;
	metadata: Record<string, unknown>;
	requiresSubtaskSelection: boolean;
};
