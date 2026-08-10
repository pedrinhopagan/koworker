import { expect, test } from "bun:test";

import { agentRadarAgentLabel } from "./agent-radar";

test("exibe nomes próprios para Prime Agent e Pi", () => {
	expect(agentRadarAgentLabel("prime-agent")).toBe("Prime Agent");
	expect(agentRadarAgentLabel("pi")).toBe("Pi");
});

test("exibe o nome de marca das CLIs com ícone próprio", () => {
	expect(agentRadarAgentLabel("claude")).toBe("Claude Code");
	expect(agentRadarAgentLabel("codex")).toBe("Codex");
});

test("preserva CLIs que não têm nome de apresentação", () => {
	expect(agentRadarAgentLabel("droid")).toBe("droid");
});
