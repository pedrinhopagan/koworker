import type { SkillSource } from "@/types/skills";

export const SKILL_TOOL_LABEL: Record<SkillSource["tool"], string> = {
	opencode: "opencode",
	"claude-code": "Claude Code",
	codex: "Codex",
	agents: "Agents",
	koworker: "Koworker",
};

// Agents que o usuário pode cadastrar um caminho custom (koworker fica de fora: é o static interno).
export const SKILL_TOOLS: SkillSource["tool"][] = ["opencode", "claude-code", "codex", "agents"];
