import { expect, test } from "bun:test";

import { agentRadarAgentLabel } from "./agent-radar";

test("exibe nomes próprios para Prime Agent e Pi", () => {
	expect(agentRadarAgentLabel("prime-agent")).toBe("Prime Agent");
	expect(agentRadarAgentLabel("pi")).toBe("Pi");
});

test("preserva CLIs que não têm nome de apresentação", () => {
	expect(agentRadarAgentLabel("claude")).toBe("claude");
});
