import { ORPCError } from "@orpc/server";
import type { z } from "zod";

import type { AgentModelConfigureSchema, CliModelOption } from "@/api/schemas/agent-radar";
import { agentRadarCli } from "@/constants/agent-radar";
import { inspectShellAgent } from "@/api/helpers/shells/agent-detect";
import { shellRuntime } from "@/api/helpers/shells/supervisor";
import { kwTerminalPaneRead, kwTerminalPaneSendInput } from "@/api/helpers/terminal/kw-terminal";
import { withTerminalInteraction } from "@/api/helpers/terminal/interaction";
import { agentPromptInput } from "@/lib/agent-prompt-input";
import { normalizeModelName, sessionModelId } from "@/lib/model-target";
import { loadModelCatalog } from "./model-catalog";
import { getRadarAgent } from "./state";

type ModelCli = z.infer<typeof AgentModelConfigureSchema>["cli"];
type ModelTerminal = {
	read: () => Promise<string>;
	write: (data: string) => Promise<void>;
};

type ModelSelection = Pick<
	z.infer<typeof AgentModelConfigureSchema>,
	"cli" | "model" | "effort"
> & {
	options: CliModelOption[];
};

const EFFORT_NAMES: Record<string, string> = { xhigh: "Extra high" };
const CODEX_EFFORT = "none|minimal|low|medium|high|xhigh|max|ultra";
const CLAUDE_EFFORT = "low|medium|high|xhigh|max|ultracode";
const CLAUDE_NAME = "(?:Fable|Opus|Sonnet|Haiku)\\s+[\\d.]+";

type ScreenReading = { index: number; model?: string; effort?: string };

function readings(
	screen: string,
	pattern: RegExp,
	read: (match: RegExpExecArray) => ScreenReading,
) {
	return [...screen.matchAll(pattern)].map((match) => read(match as RegExpExecArray));
}

// O terminal mostra o modelo e o esforço em vários lugares: cabeçalho de abertura, confirmação de
// cada `/model` e `/effort`, indicador de esforço e rodapé. Vale o que aparece por último na tela,
// que é a troca mais recente; o cabeçalho fica como último recurso porque nunca é redesenhado.
export function terminalModelConfiguration(cli: ModelCli, screen: string) {
	const found =
		cli === "codex"
			? [
					...readings(screen, /model:\s+([\w.-]+)\s+(\w+)/gi, (match) => ({
						index: match.index,
						model: match[1]!,
						effort: match[2]!,
					})),
					...readings(
						screen,
						new RegExp(`Model changed to ([\\w.-]+) (${CODEX_EFFORT})\\b`, "g"),
						(match) => ({ index: match.index, model: match[1]!, effort: match[2]! }),
					),
					...readings(
						screen,
						new RegExp(`(GPT-[\\w.-]+)\\s+(${CODEX_EFFORT})\\s*·`, "gi"),
						(match) => ({ index: match.index, model: match[1]!, effort: match[2]! }),
					),
				]
			: [
					...readings(
						screen,
						new RegExp(`(${CLAUDE_NAME})(?:\\s+\\([^\\n]*?\\))?\\s+with\\s+(\\w+)\\s+effort`, "gi"),
						(match) => ({ index: match.index, model: match[1]!, effort: match[2]! }),
					),
					...readings(
						screen,
						new RegExp(
							`Set model to \`?(${CLAUDE_NAME})\`?(?:[^\\n]*?with \`?(\\w+)\`? effort)?`,
							"g",
						),
						(match) => ({
							index: match.index,
							model: match[1]!,
							...(match[2] ? { effort: match[2] } : {}),
						}),
					),
					...readings(screen, /Set effort level to (\w+)/g, (match) => ({
						index: match.index,
						effort: match[1]!,
					})),
					...readings(
						screen,
						new RegExp(`[○◐◑◒◓◉●]\\s+(${CLAUDE_EFFORT})\\s+·\\s+/effort`, "gi"),
						(match) => ({ index: match.index, effort: match[1]! }),
					),
					...readings(
						screen,
						new RegExp(`\\((${CLAUDE_NAME})(?:\\s+\\S+)*?(?:\\s+(${CLAUDE_EFFORT}))?\\)`, "gi"),
						(match) => ({
							index: match.index,
							model: match[1]!,
							...(match[2] ? { effort: match[2] } : {}),
						}),
					),
				];
	const ordered = found.sort((left, right) => left.index - right.index);
	const model = ordered.findLast((reading) => reading.model)?.model;
	if (!model) {
		return null;
	}
	const effort = ordered.findLast((reading) => reading.effort)?.effort ?? null;

	return {
		model: cli === "codex" ? model.toLowerCase() : model.replaceAll(/\s+/g, " "),
		effort: effort?.toLowerCase() ?? null,
	};
}

// O terminal fala em nomes ("Sonnet 5"); o app, em ids do catálogo. Modelo sem esforço (Haiku) não
// herda o esforço que o indicador ainda mostra do modelo anterior.
function resolveConfiguration(
	options: CliModelOption[],
	reading: ReturnType<typeof terminalModelConfiguration>,
) {
	if (!reading) {
		return null;
	}
	const model = sessionModelId(options, reading.model) ?? reading.model;
	const option = options.find((candidate) => candidate.id === model);

	return { model, effort: option && option.efforts.length === 0 ? null : reading.effort };
}

async function modelTerminal(paneId: string) {
	const shell = shellRuntime.snapshot(paneId);
	if (shell) {
		const process = shell.status === "live" ? await inspectShellAgent(shell.pid) : null;
		const cli = process && agentRadarCli(process.agent);
		if (!process || !cli) {
			throw new ORPCError("CONFLICT", {
				message: "Claude Code ou Codex não está ativo neste shell",
			});
		}
		return {
			cli,
			read: async () => {
				const current = await inspectShellAgent(shell.pid);
				if (current?.pid !== process.pid || current.agent !== cli) {
					throw new ORPCError("CONFLICT", { message: "O agente mudou durante a operação" });
				}
				const screen = shellRuntime.readScreen(paneId);
				if (screen === null) {
					throw new ORPCError("NOT_FOUND", { message: "O shell foi encerrado" });
				}
				return screen;
			},
			write: async (data: string) => {
				const current = await inspectShellAgent(shell.pid);
				if (
					current?.pid !== process.pid ||
					current.agent !== cli ||
					!shellRuntime.execute({ type: "input", id: paneId, data })
				) {
					throw new ORPCError("CONFLICT", { message: "O agente mudou durante a operação" });
				}
			},
		};
	}

	const agent = getRadarAgent(paneId);
	const cli = agentRadarCli(agent?.agent);
	if (!agent || !cli) {
		throw new ORPCError("NOT_FOUND", { message: "Este agente não está mais aberto" });
	}
	return {
		cli,
		read: async () => {
			if (getRadarAgent(paneId)?.sessionId !== agent.sessionId) {
				throw new ORPCError("CONFLICT", { message: "A sessão mudou durante a operação" });
			}
			return Bun.stripANSI((await kwTerminalPaneRead(paneId)).ansi);
		},
		write: async (data: string) => {
			if (getRadarAgent(paneId)?.sessionId !== agent.sessionId) {
				throw new ORPCError("CONFLICT", { message: "A sessão mudou durante a operação" });
			}
			await kwTerminalPaneSendInput(paneId, data);
		},
	};
}

async function waitScreen(terminal: ModelTerminal, check: (screen: string) => boolean) {
	const deadline = Date.now() + 5_000;
	while (Date.now() < deadline) {
		const screen = await terminal.read();
		if (check(screen)) {
			return screen;
		}
		await Bun.sleep(80);
	}
	throw new ORPCError("PRECONDITION_FAILED", {
		message:
			"O CLI não confirmou a troca. Abra o terminal para conferir uma confirmação ou restrição pendente.",
	});
}

export function selectedModelRow(screen: string) {
	return /^[^\S\r\n]*[›❯»][^\S\r\n]*\d+\.[^\S\r\n]*(.+)$/m.exec(screen)?.[1] ?? null;
}

async function selectRow(terminal: ModelTerminal, label: string) {
	const visited = new Set<string>();
	for (let index = 0; index < 80; index++) {
		const screen = await waitScreen(terminal, (screen) => !!selectedModelRow(screen));
		const selected = selectedModelRow(screen)!;
		if (
			normalizeModelName(selected.split(/\s{2,}|\s+\(|\s+✔/, 1)[0]!) === normalizeModelName(label)
		) {
			return screen;
		}
		if (visited.has(selected)) {
			break;
		}
		visited.add(selected);
		await terminal.write("\u001B[B");
		await waitScreen(terminal, (screen) => selectedModelRow(screen) !== selected);
	}
	throw new ORPCError("BAD_REQUEST", {
		message: "A opção não está disponível no seletor deste CLI",
	});
}

function selectedClaudeEffort(screen: string) {
	return /\b(low|medium|high|xhigh|max) effort/i
		.exec(screen.slice(screen.lastIndexOf("Select model")))?.[1]
		?.toLowerCase();
}

function assertComposer(initial: string) {
	const composer = [...initial.matchAll(/^[^\S\r\n]*[›❯»][^\S\r\n]*(.*)$/gm)].at(-1)?.[1]?.trim();
	if (composer === undefined) {
		throw new ORPCError("CONFLICT", {
			message: "O terminal está esperando uma interação. Conclua antes de trocar o modelo.",
		});
	}
	if (composer && !/^(Ask Codex to do anything|Try "[^"]+")$/.test(composer)) {
		throw new ORPCError("CONFLICT", {
			message: "Há texto ou um menu aberto no terminal. Conclua ou limpe antes de trocar o modelo.",
		});
	}
	if (
		selectedModelRow(initial) ||
		/Select model|Select Model|Select Reasoning|Advanced Reasoning/.test(initial)
	) {
		throw new ORPCError("CONFLICT", {
			message: "Conclua o menu aberto no terminal antes de trocar",
		});
	}
}

function effortSlider(screen: string) {
	const lines = screen.split("\n");
	const index = lines.findLastIndex((line) => /\blow\s+medium\s+high/.test(line));
	const labels = lines[index];
	const cursor = lines[index - 1]?.indexOf("▲") ?? -1;
	if (!labels || cursor < 0) {
		return null;
	}
	return (
		[...labels.matchAll(/low|medium|high|xhigh|max|ultracode/g)].sort(
			(left, right) =>
				Math.abs(left.index + left[0].length / 2 - cursor) -
				Math.abs(right.index + right[0].length / 2 - cursor),
		)[0]?.[0] ?? null
	);
}

async function applyClaudeEffort(terminal: ModelTerminal, effort: string) {
	await terminal.write(agentPromptInput("claude", "/effort"));
	await Bun.sleep(100);
	await terminal.write("\r");
	await waitScreen(terminal, (screen) => !!effortSlider(screen));
	const levels = ["low", "medium", "high", "xhigh", "max", "ultracode"];
	for (let attempt = 0; attempt < levels.length; attempt++) {
		const current = effortSlider(await terminal.read());
		if (current === effort) {
			await terminal.write("s");
			return;
		}
		if (!current) {
			break;
		}
		await terminal.write(
			levels.indexOf(current) < levels.indexOf(effort) ? "\u001B[C" : "\u001B[D",
		);
		await waitScreen(terminal, (screen) => effortSlider(screen) !== current);
	}
	throw new ORPCError("BAD_REQUEST", { message: "O esforço não está disponível para este modelo" });
}

// Com a conversa em cache, o Claude pergunta se troca mesmo ("Switch model?", porque o histórico
// vai ser relido). A troca foi pedida pela pessoa, então a pergunta é respondida com o "Yes".
async function confirmSwitch(terminal: ModelTerminal, applied: (screen: string) => boolean) {
	const settled = await waitScreen(
		terminal,
		(screen) => /Switch model\?/.test(screen) || applied(screen),
	);
	if (/Switch model\?/.test(settled)) {
		if (!/^[^\S\r\n]*[›❯][^\S\r\n]*1\.[^\S\r\n]*Yes/m.test(settled)) {
			throw new ORPCError("CONFLICT", { message: "O Claude pediu uma confirmação inesperada" });
		}
		await terminal.write("\r");
	}

	return await waitScreen(terminal, applied);
}

async function applyTerminalModel(terminal: ModelTerminal, input: ModelSelection) {
	if (input.cli === "claude" && !input.model && input.effort) {
		await applyClaudeEffort(terminal, input.effort);
		const confirmed = await confirmSwitch(
			terminal,
			(screen) =>
				!effortSlider(screen) &&
				!/Switch model\?/.test(screen) &&
				terminalModelConfiguration("claude", screen)?.effort === input.effort,
		);
		return resolveConfiguration(input.options, terminalModelConfiguration("claude", confirmed))!;
	}

	await terminal.write(agentPromptInput(input.cli, "/model"));
	await Bun.sleep(100);
	await terminal.write("\r");
	await waitScreen(terminal, (screen) => /Select [Mm]odel/.test(screen));

	const option = input.options.find((candidate) => candidate.id === input.model);
	if (input.model && !option) {
		throw new ORPCError("BAD_REQUEST", { message: "Modelo não disponível para este CLI" });
	}
	if (input.cli === "codex") {
		const screen = await terminal.read();
		if (/All models/.test(screen) && !/Select Model and Effort/.test(screen)) {
			await selectRow(terminal, "All models");
			await terminal.write("\r");
			await waitScreen(terminal, (screen) => screen.includes("Select Model and Effort"));
		}
	}
	if (option) {
		await selectRow(terminal, option.label);
	}

	if (input.cli === "claude") {
		if (input.effort) {
			const levels = ["low", "medium", "high", "xhigh", "max"];
			for (let attempt = 0; attempt < levels.length; attempt++) {
				const screen = await terminal.read();
				const current = selectedClaudeEffort(screen);
				if (current === input.effort) {
					break;
				}
				if (!current) {
					throw new ORPCError("BAD_REQUEST", {
						message: "O modelo não oferece controle de esforço",
					});
				}
				await terminal.write(
					levels.indexOf(current) < levels.indexOf(input.effort) ? "\u001B[C" : "\u001B[D",
				);
				await waitScreen(terminal, (screen) => selectedClaudeEffort(screen) !== current);
			}
			await waitScreen(terminal, (screen) => selectedClaudeEffort(screen) === input.effort);
		}
		await terminal.write("s");
	} else {
		const before = await terminal.read();
		await terminal.write(option && option.efforts.length <= 1 ? "s" : "\r");
		await waitScreen(
			terminal,
			(screen) =>
				screen !== before &&
				!/Select Model(?: and Effort)?/.test(screen) &&
				/Select Reasoning Level|Model changed to/.test(screen),
		);
		const screen = await terminal.read();
		if (screen.includes("Select Reasoning Level")) {
			if (input.effort) {
				if (["max", "ultra"].includes(input.effort)) {
					await selectRow(terminal, "More reasoning");
					await terminal.write("\r");
					await waitScreen(terminal, (screen) => screen.includes("Advanced Reasoning"));
				}
				await selectRow(terminal, EFFORT_NAMES[input.effort] ?? input.effort);
			}
			await terminal.write("s");
		}
	}

	const confirmed = await confirmSwitch(terminal, (screen) => {
		if (
			/Select [Mm]odel|Select Reasoning Level|Advanced Reasoning|Switch model\?|^\s*Effort\s*$/m.test(
				screen,
			)
		) {
			return false;
		}
		const configuration = resolveConfiguration(
			input.options,
			terminalModelConfiguration(input.cli, screen),
		);
		return (
			!!configuration &&
			(!input.model || configuration.model === input.model) &&
			(!input.effort || configuration.effort === input.effort)
		);
	});
	return resolveConfiguration(input.options, terminalModelConfiguration(input.cli, confirmed))!;
}

export async function configureTerminalModel(terminal: ModelTerminal, input: ModelSelection) {
	assertComposer(await terminal.read());
	try {
		return await applyTerminalModel(terminal, input);
	} catch (error) {
		for (let attempt = 0; attempt < 4; attempt++) {
			const screen = await terminal.read().catch(() => null);
			if (
				!screen ||
				!/Select [Mm]odel|Select Reasoning Level|Advanced Reasoning|Switch model\?|^\s*Effort\s*$/m.test(
					screen,
				)
			) {
				break;
			}
			await terminal.write("\u001B").catch(() => {});
			await Bun.sleep(120);
		}
		throw error;
	}
}

export async function getTerminalModelConfiguration(paneId: string) {
	const terminal = await modelTerminal(paneId);
	const catalog = await loadModelCatalog();

	return resolveConfiguration(
		catalog[terminal.cli],
		terminalModelConfiguration(terminal.cli, await terminal.read()),
	);
}

export async function configurePaneModel(input: z.infer<typeof AgentModelConfigureSchema>) {
	return await withTerminalInteraction(input.paneId, async () => {
		const terminal = await modelTerminal(input.paneId);
		if (terminal.cli !== input.cli) {
			throw new ORPCError("CONFLICT", { message: "O CLI da conversa mudou" });
		}
		const catalog = await loadModelCatalog();
		const current = input.model
			? null
			: resolveConfiguration(
					catalog[input.cli],
					terminalModelConfiguration(input.cli, await terminal.read()),
				);
		const option = catalog[input.cli].find(
			(option) => option.id === (input.model ?? current?.model),
		);
		if (!option || (input.effort && !option.efforts.includes(input.effort))) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Modelo ou esforço não disponível para este CLI",
			});
		}
		return await configureTerminalModel(terminal, { ...input, options: catalog[input.cli] });
	});
}
