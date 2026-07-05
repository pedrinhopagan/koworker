import type { RouterOutputs } from "@/client";

export type PromptHistoryKind = RouterOutputs["promptHistory"]["list"]["items"][number]["kind"];

export const PROMPT_HISTORY_KIND_LABEL: Record<PromptHistoryKind, string> = {
	copy: "Copiado",
	agent: "Agent",
	skill: "Skill",
};
