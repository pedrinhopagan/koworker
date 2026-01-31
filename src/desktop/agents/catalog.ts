import type {
	Agent,
	AgentId,
	BuildAgentCommandInput,
	BuiltAgentCommand,
} from "./types";

/**
 * Catálogo hardcoded (MVP).
 *
 * Observação: CLIs de agentes tendem a variar rapidamente. Este catálogo prioriza:
 * - ids estáveis
 * - contrato de execução consistente: {cmd,args,stdin?}
 * - permitir ajustes futuros (flags/env) sem refatorar chamadas.
 */
export const AGENTS: Agent[] = [
	{
		id: "claude",
		nome: "Claude (CLI)",
		cmd: "claude",
		argsBase: [],
		// Claude Code costuma aceitar --model. Se não existir no ambiente do usuário, o caller/validação pode alertar.
		model: { kind: "flag", flag: "--model" },
		// Modo mais comum em CLIs do Claude: `-p/--prompt` para execução 1-shot.
		prompt: { kind: "arg", flag: "-p" },
		observacoes: [
			"Em algumas instalações o Claude roda em modo interativo por padrão; use flag de prompt (ex: -p) para 1-shot.",
			"Se o binário `claude` não existir, verificar instalação do Claude Code.",
		],
	},
	{
		id: "opencode",
		nome: "OpenCode",
		cmd: "opencode",
		argsBase: [],
		// O OpenCode tem model no config (opencode.json), mas costuma permitir override por flag.
		model: { kind: "flag", flag: "--model" },
		// Para robustez, preferimos stdin (evita problemas de escaping em prompts longos).
		prompt: { kind: "stdin" },
		observacoes: [
			"OpenCode pode usar `opencode.json` para default model; `--model` faz override quando suportado.",
			"Prompt via stdin é o caminho mais robusto para textos longos/multilinha.",
		],
	},
	{
		id: "codex",
		nome: "Codex",
		cmd: "codex",
		argsBase: [],
		model: { kind: "flag", flag: "--model" },
		// Codex geralmente aceita stdin para o prompt. Mantemos esse modo por compatibilidade.
		prompt: { kind: "stdin" },
		observacoes: [
			"Em ambientes onde o Codex CLI usa subcomandos (ex: `codex exec`), ajustar `argsBase`.",
			"Prompt via stdin evita limites/escaping de CLI.",
		],
	},
];

export function getAgent(id: AgentId): Agent {
	const found = AGENTS.find((a) => a.id === id);
	if (!found) {
		// Ajuda o TS a entender exaustividade; em runtime isso só acontece se houver cast indevido.
		throw new Error(`Agent não encontrado: ${id}`);
	}
	return found;
}

/**
 * Constrói comando de execução do agente.
 *
 * Retorna uma estrutura neutra para spawn do processo pelo Desktop (Tauri/Bun):
 * - cmd: binário
 * - args: array de args
 * - stdin: conteúdo a ser escrito no stdin (quando aplicável)
 */
export function buildAgentCommand(
	input: BuildAgentCommandInput,
): BuiltAgentCommand {
	const agent = getAgent(input.agentId);

	const args: string[] = [...agent.argsBase];

	if (input.model && agent.model.kind === "flag") {
		args.push(agent.model.flag, input.model);
	}

	let stdin: string | undefined;

	if (agent.prompt.kind === "stdin") {
		stdin = input.prompt;
	} else {
		if (agent.prompt.flag) {
			args.push(agent.prompt.flag, input.prompt);
		} else {
			args.push(input.prompt);
		}
	}

	if (input.extraArgs?.length) {
		args.push(...input.extraArgs);
	}

	return {
		cmd: agent.cmd,
		args,
		stdin,
	};
}
