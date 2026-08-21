import { describe, expect, test } from "bun:test";

import {
	DEFAULT_PROJECT_ROUTES,
	isProjectCliRoute,
	resolveProjectDocIcon,
	resolveProjectRouteIcon,
} from "./projects";

describe("atalhos de projeto", () => {
	test("inclui pi nos atalhos de todo projeto novo", () => {
		expect(DEFAULT_PROJECT_ROUTES).toContainEqual({
			name: "pi",
			command: "pi",
			icon: "SquareTerminal",
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
		expect(resolveProjectRouteIcon({ name: "Deploy", command: "bun run deploy" })).toBe("Rocket");
		expect(resolveProjectRouteIcon({ name: "Testes", command: "bun test" })).toBe("FlaskConical");
		expect(resolveProjectRouteIcon({ name: "Banco", command: "bun run db:migrate" })).toBe(
			"Database",
		);
	});

	test("diferencia os documentos principais pelos ícones", () => {
		expect(resolveProjectDocIcon("AGENTS.md")).toBe("Bot");
		expect(resolveProjectDocIcon("README.md")).toBe("BookOpenText");
		expect(resolveProjectDocIcon("CONTRIBUTING.md")).toBe("GitPullRequestArrow");
		expect(resolveProjectDocIcon("ARCHITECTURE.md")).toBe("Network");
		expect(resolveProjectDocIcon("SECURITY.md")).toBe("ShieldCheck");
	});
});
