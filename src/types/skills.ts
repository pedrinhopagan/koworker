import type { RouterOutputs } from "@/client";

export type SkillRecord = RouterOutputs["skills"]["list"][number];
export type SkillSource = SkillRecord["sources"][number];

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
	primaryPath: string;
	requiresSubtaskSelection: boolean;
};
