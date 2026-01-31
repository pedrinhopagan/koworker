export const AGENT_IDS = ["mock", "opencode", "codex", "claude"] as const;

// NOTE:
// - "agent" here is the execution provider/engine for now (MVP).
// - In the future, agents may become a first-class entity with their own ids.
export type AgentId = (typeof AGENT_IDS)[number];

// Curated (MVP) list per agent.
// - Keep this intentionally small: it should represent the models we *want* users to pick.
// - opencode: MVP allows any string (OpenCode will be the first to support a custom model field).
export const MODELS_BY_AGENT: Record<AgentId, readonly string[]> = {
  mock: [],
  opencode: [],
  codex: [
    "openai/gpt-5.2-codex",
    "openai/gpt-5.1-codex",
    "openai/gpt-5-codex",
    "openai/gpt-4.1",
  ],
  claude: [
    "anthropic/claude-opus-4.5",
    "anthropic/claude-sonnet-4.5",
    "anthropic/claude-opus-4",
    "anthropic/claude-sonnet-4",
  ],
} as const;

export function isModelAllowed(agentId: AgentId, model: string): boolean {
  if (!model.trim()) {
    return false;
  }

  // MVP: OpenCode accepts any model string (custom/free-form).
  if (agentId === "opencode") {
    return true;
  }

  const allowed = MODELS_BY_AGENT[agentId];
  return allowed.includes(model);
}
