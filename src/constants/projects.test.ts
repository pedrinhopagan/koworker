import { describe, expect, test } from "bun:test";

import {
	DEFAULT_PROJECT_ROUTES,
	isProjectCliRoute,
	resolveProjectDocIcon,
	resolveProjectRouteIcon,
} from "./projects";

describe("atalhos de projeto", () => {
	test("inclui prime-agent nos atalhos de todo projeto novo", () => {
		expect(DEFAULT_PROJECT_ROUTES).toContainEqual({
			name: "prime-agent",
			command: "prime-agent",
			icon: "Sparkles",
		});
	});

	test("separa CLIs de ações executadas por uma CLI", () => {
		expect(
			isProjectCliRoute({
				name: "claude_vault",
				command: "claude --dangerously-skip-permissions",
			}),
		).toBeTrue();
		expect(
			isProjectCliRoute({
				name: "Commit",
				command: 'claude --dangerously-skip-permissions "/commit"',
			}),
		).toBeFalse();
	});

	test("resolve ícones pela intenção da ação", () => {
		expect(
			resolveProjectRouteIcon({
				name: "codex",
				command: "codex --yolo",
				icon: "Cpu",
			}),
		).toBe("SquareTerminal");
		expect(
			resolveProjectRouteIcon({
				name: "Iniciar jogo",
				command: "bun run jogo:iniciar",
			}),
		).toBe("Gamepad2");
		expect(
			resolveProjectRouteIcon({
				name: "Parar jogo",
				command: "bun run jogo:parar",
			}),
		).toBe("CircleStop");
		expect(resolveProjectRouteIcon({ name: "Build", command: "bun run build" })).toBe("Hammer");
	});

	test("diferencia os documentos principais pelos ícones", () => {
		expect(resolveProjectDocIcon("AGENTS.md")).toBe("Bot");
		expect(resolveProjectDocIcon("README.md")).toBe("BookOpenText");
		expect(resolveProjectDocIcon("CONTRIBUTING.md")).toBe("GitPullRequestArrow");
		expect(resolveProjectDocIcon("ARCHITECTURE.md")).toBe("Network");
		expect(resolveProjectDocIcon("SECURITY.md")).toBe("ShieldCheck");
	});
});
