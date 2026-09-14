import type { PromptSource } from "@/api/schemas/prompt-history";

export const PROMPT_SOURCE_LABEL: Record<PromptSource, string> = {
	claude: "Claude",
	codex: "Codex",
	copy: "Copiado",
};
