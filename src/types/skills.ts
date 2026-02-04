import type { RouterOutputs } from "@/client";

export type SkillRecord = RouterOutputs["skills"]["list"][number];
export type SkillSyncPreviewItem = RouterOutputs["skills"]["previewImportFromConfig"][number];

export type TaskSkill = {
	id: string;
	slug: string;
	label: string;
	description: string;
	instructions: string;
	icon: string;
	color: string;
	source: "builtin" | "custom";
	requiresSubtaskSelection: boolean;
};
