import { expect, test } from "bun:test";

import type { CliModelOption } from "@/api/schemas/agent-radar";
process.env.NODE_ENV = "development";

const { withTerminalInteraction } = await import("../terminal/interaction");
const { configureTerminalModel, selectedModelRow, terminalModelConfiguration } =
	await import("./model-configure");

function option(id: string, label: string, efforts: string[]): CliModelOption {
	return { id, label, hint: "", efforts, defaultEffort: null, legacy: false };
}

const CLAUDE_EFFORTS = ["low", "medium", "high", "xhigh", "max"];
const CLAUDE = [
	option("claude-opus-5-5", "Opus 5.5", CLAUDE_EFFORTS),
	option("claude-sonnet-5", "Sonnet 5", CLAUDE_EFFORTS),
	option("claude-haiku-4-5-20251001", "Haiku 4.5", []),
];
const CODEX = [
	option("gpt-6-sol", "GPT-6-Sol", ["low", "medium", "high", "xhigh", "max", "ultra"]),
	option("gpt-6-luna", "GPT-6-Luna", ["low", "medium", "high", "xhigh", "max"]),
];

test("estado do Codex usa o rodapé vivo em vez do cabeçalho e aviso antigos", () => {
	expect(
		terminalModelConfiguration(
			"codex",
			"│ model: GPT-6-Sol high /model to change │\n• Model changed to gpt-6-luna medium for this session only\n  GPT-6-Sol ultra · weekly 81% left",
		),
	).toEqual({ model: "gpt-6-sol", effort: "ultra" });
});

test("rodapé do Codex depois do primeiro turno traz o uso antes do modelo", () => {
	expect(
		terminalModelConfiguration(
			"codex",
			"│ model:     GPT-6-Sol low   /model to change │\n• Model changed to gpt-6-luna high for this session only\n› Ask Codex to do anything\n  28.7K used · GPT-6-Sol medium · weekly 98% left",
		),
	).toEqual({ model: "gpt-6-sol", effort: "medium" });
	expect(
		terminalModelConfiguration(
			"codex",
			"│ model:     GPT-6-Sol low   /model to change │\n• Model changed to gpt-6-luna high for this session only\n› Ask Codex to do anything",
		),
	).toEqual({ model: "gpt-6-luna", effort: "high" });
});

test("estado do Claude vem do nome exibido, da última confirmação e do indicador de esforço", () => {
	expect(
		terminalModelConfiguration("claude", "Opus 5.5 with low effort\n ⎇ main (Sonnet 5 high)"),
	).toEqual({ model: "Sonnet 5", effort: "high" });
	expect(
		terminalModelConfiguration(
			"claude",
			"▝▜██████▀  Opus 5.5 with xhigh effort · Claude Max\n❯ /model\n  ⎿  Set model to Sonnet 5 for this session only with low effort\n❯ /effort\n  ⎿  Set effort level to medium (this session only): Balanced\n    ◐ medium · /effort\n❯ ",
		),
	).toEqual({ model: "Sonnet 5", effort: "medium" });
});

test("linha selecionada não captura cabeçalhos nem texto de conversa", () => {
	expect(selectedModelRow("› /model\n   1. GPT-6-Astra\n› 2. GPT-6-Sol (current)\n")).toBe(
		"GPT-6-Sol (current)",
	);
	expect(selectedModelRow("❯ \n Select model")).toBeNull();
});

test.each([
	"❯ Fix this code",
	"› mensagem pendente",
	"› 2. GPT-6-Sol\nSelect Model and Effort",
	"Confirm access?",
])("não altera texto ou interação pendente: %s", async (screen) => {
	const writes: string[] = [];
	await expect(
		configureTerminalModel(
			{
				read: () => Promise.resolve(screen),
				write: (data) => {
					writes.push(data);
					return Promise.resolve();
				},
			},
			{ cli: "codex", model: "gpt-6-sol", options: CODEX },
		),
	).rejects.toThrow();
	expect(writes).toEqual([]);
});

test("envios e trocas concorrentes são rejeitados e o lock é liberado após falha", async () => {
	let release!: () => void;
	const pending = withTerminalInteraction("pane", async () => {
		await new Promise<void>((resolve) => {
			release = resolve;
		});
		throw new Error("falha");
	});
	await expect(withTerminalInteraction("pane", () => Promise.resolve(true))).rejects.toThrow(
		"Uma operação já está em andamento",
	);
	release();
	await expect(pending).rejects.toThrow("falha");
	expect(await withTerminalInteraction("pane", () => Promise.resolve(true))).toBe(true);
});

// Menu real do `/model` do Claude Code 2.1.283: os itens são nomes com versão ("Opus 5.5"), não os
// apelidos, e o esforço de cada linha é o salvo daquele modelo. Sem statusline customizada: a
// confirmação vem da linha "Set model to …" e do indicador de esforço.
function fakeClaude(initialRow: number) {
	const rows = [
		"Default (recommended)",
		"Opus 5.5",
		"Fable 5.1",
		"Sonnet 5",
		"Haiku 4.5",
		"Opus 5",
	];
	const levels = ["low", "medium", "high", "xhigh", "max"];
	const saved: Record<string, number> = { "Opus 5.5": 3, "Sonnet 5": 1 };
	let menu = false;
	let row = initialRow;
	let effort = 3;
	let current = { model: rows[initialRow]!, effort: "xhigh" };
	const writes: string[] = [];
	const effortLine = () =>
		rows[row] === "Haiku 4.5"
			? "○ Effort not supported for Haiku 4.5"
			: `◐ ${levels[effort]!.replace("xhigh", "xHigh")} effort ←/→ to adjust`;
	const terminal = {
		read: () => {
			const history = `▝▜██████▀  Opus 5.5 with xhigh effort · Claude Max\n  ⎿  Set model to ${current.model} for this session only with ${current.effort} effort\n`;
			if (!menu) {
				return Promise.resolve(
					`${history}                ◐ ${current.effort} · /effort\n───\n❯ Try "fix lint"\n───\n  ⏸ manual mode on`,
				);
			}
			const list = rows
				.map(
					(name, index) =>
						`   ${index === row ? "❯" : " "} ${index + 1}.  ${name}${name === current.model ? " ✔" : ""}   Descrição`,
				)
				.join("\n");
			return Promise.resolve(
				`${history}   Select model\n   Switch between Claude models.\n\n${list}\n\n   ${effortLine()}\n\n   Enter to set as default · s to use this session only · Esc to cancel`,
			);
		},
		write: (data: string) => {
			writes.push(data);
			if (data === "\r") {
				menu = true;
			}
			if (data === "\u001B[B") {
				row = (row + 1) % rows.length;
				effort = saved[rows[row]!] ?? 2;
			}
			if (data === "\u001B[C") {
				effort = Math.min(levels.length - 1, effort + 1);
			}
			if (data === "\u001B[D") {
				effort = Math.max(0, effort - 1);
			}
			if (data === "s") {
				menu = false;
				current = { model: rows[row]!, effort: levels[effort]! };
			}
			return Promise.resolve();
		},
	};

	return { terminal, writes };
}

test("Claude acha a linha pelo nome do catálogo e aplica o esforço pedido só na sessão", async () => {
	const { terminal, writes } = fakeClaude(1);
	expect(
		await configureTerminalModel(terminal, {
			cli: "claude",
			model: "claude-sonnet-5",
			effort: "high",
			options: CLAUDE,
		}),
	).toEqual({ model: "claude-sonnet-5", effort: "high" });
	expect(writes.at(-1)).toBe("s");
	expect(writes).not.toContain("\r\r");
	expect(writes.filter((data) => data === "\u001B[B").length).toBe(2);
});

test("Claude volta ao topo da lista para achar um modelo acima do atual", async () => {
	const { terminal } = fakeClaude(3);
	expect(
		await configureTerminalModel(terminal, {
			cli: "claude",
			model: "claude-opus-5-5",
			effort: "max",
			options: CLAUDE,
		}),
	).toEqual({ model: "claude-opus-5-5", effort: "max" });
});

test("trocar apenas esforço no Claude usa /effort e preserva o modelo fixado", async () => {
	let menu = false;
	let applied = false;
	let effort = 2;
	const levels = ["low", "medium", "high", "xhigh", "max"];
	const labels = "   low       medium       high       xhigh       max";
	const writes: string[] = [];
	const terminal = {
		read: () => {
			if (!menu) {
				return Promise.resolve(`❯ \n ⎇ main (Opus 4.6 ${applied ? "medium" : "high"})`);
			}
			const selected = levels[effort]!;
			const pointer = labels.indexOf(selected) + Math.floor(selected.length / 2);
			return Promise.resolve(`Effort\n${"─".repeat(pointer)}▲\n${labels}`);
		},
		write: (data: string) => {
			writes.push(data);
			if (data === "\r") {
				menu = true;
			}
			if (data === "\u001B[D") {
				effort--;
			}
			if (data === "s") {
				menu = false;
				applied = true;
			}
			return Promise.resolve();
		},
	};
	expect(
		await configureTerminalModel(terminal, {
			cli: "claude",
			effort: "medium",
			options: [...CLAUDE, option("claude-opus-4-6", "Opus 4.6", CLAUDE_EFFORTS)],
		}),
	).toEqual({ model: "claude-opus-4-6", effort: "medium" });
	expect(writes[0]).toBe("/effort");
	expect(writes.at(-1)).toBe("s");
});

// Menu real do `/model` do codex 0.157: modelo, depois nível de raciocínio; max e ultra moram no
// submenu "More reasoning…". `s` aplica só na sessão, Enter gravaria como padrão.
function fakeCodex() {
	const models = ["GPT-6-Astra", "GPT-6-Sol", "GPT-6-Luna"];
	const levels = ["Low", "Medium", "High", "Extra high", "More reasoning…"];
	const advanced = ["Max", "Ultra"];
	let screen: "prompt" | "models" | "levels" | "advanced" = "prompt";
	let row = 1;
	let chosen = "GPT-6-Sol";
	let current = "gpt-6-sol low";
	const writes: string[] = [];
	const rows = () =>
		({ prompt: [], models, levels, advanced })[screen]
			.map((name, index) => `${index === row ? "›" : " "} ${index + 1}. ${name}   Descrição`)
			.join("\n");
	const titles = {
		prompt: "",
		models: "  Select Model and Effort",
		levels: `  Select Reasoning Level for ${chosen}`,
		advanced: "  Advanced Reasoning",
	};
	const terminal = {
		read: () => {
			const [model, effort] = current.split(" ");
			const footer = `\n› Ask Codex to do anything\n  28.7K used · ${models.find((name) => name.toLowerCase() === model)} ${effort} · weekly 98% left`;
			return Promise.resolve(
				`│ model:     GPT-6-Sol low   /model to change │\n• Model changed to ${current} for this session only\n${
					screen === "prompt"
						? footer
						: `${titles[screen]}\n${rows()}\n  enter default · s session · esc back`
				}`,
			);
		},
		write: (data: string) => {
			writes.push(data);
			const list = { prompt: [], models, levels, advanced }[screen];
			if (data === "\u001B[B") {
				row = (row + 1) % list.length;
			}
			if (data === "\r") {
				if (screen === "prompt") {
					screen = "models";
					row = models.indexOf(chosen);
				} else if (screen === "models") {
					chosen = models[row]!;
					screen = "levels";
					row = 0;
				} else if (screen === "levels") {
					screen = "advanced";
					row = 0;
				}
			}
			if (data === "s" && screen !== "prompt") {
				const effort = (screen === "advanced" ? advanced : levels)[row]!.toLowerCase();
				current = `${chosen.toLowerCase()} ${effort === "extra high" ? "xhigh" : effort}`;
				screen = "prompt";
			}
			return Promise.resolve();
		},
	};

	return { terminal, writes };
}

test("Codex troca modelo e esforço avançado só na sessão e confirma pelo rodapé", async () => {
	const { terminal, writes } = fakeCodex();
	expect(
		await configureTerminalModel(terminal, {
			cli: "codex",
			model: "gpt-6-luna",
			effort: "max",
			options: CODEX,
		}),
	).toEqual({ model: "gpt-6-luna", effort: "max" });
	expect(writes.at(-1)).toBe("s");
	expect(writes.filter((data) => data === "\r").length).toBe(3);
});

test("Codex troca só o esforço mantendo o modelo atual", async () => {
	const { terminal } = fakeCodex();
	expect(
		await configureTerminalModel(terminal, { cli: "codex", effort: "xhigh", options: CODEX }),
	).toEqual({ model: "gpt-6-sol", effort: "xhigh" });
});
