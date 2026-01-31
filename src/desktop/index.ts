export { configDesktopSchema, criarConfigDesktopPadrao } from "./config";
export { listaProvedores, obterProvedor } from "./providers/registry";
export { AGENTS, buildAgentCommand, getAgent, idsAgent } from "./agents";
export type { Agent, AgentId, BuiltAgentCommand } from "./agents";
export { presetsTerminal, presetsTerminalPorId } from "./terminal/presets";
export { resolverPresetTerminal } from "./terminal/resolver";
