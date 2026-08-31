import { MemoryPublisher } from "@orpc/experimental-publisher/memory";

import type { AgentRadarTranscriptEnvelope } from "@/api/schemas/agent-radar-transcript";
import type { RadarAgent, RadarFocus } from "@/api/schemas/terminal-workspace";
import type { AgentStep } from "@/lib/agent-stream";
import type { TaskStage } from "@/constants/complexity";

const publisher = new MemoryPublisher<Record<string, object>>();

// Progresso do fluxo autônomo de uma tarefa, publicado por taskId. `stage`/`agent` nomeiam o que
// está rodando (null na revisão final e no arranque); `message` carrega só o fato que o frontend não
// deriva sozinho — o motivo da falha (timeout × código) ou a nota de por que parou no usuário.
export type FlowEvent = {
	taskId: string;
	status: "running" | "waiting-user" | "failed" | "completed";
	stage: TaskStage | null;
	agent: string | null;
	message: string | null;
};

// `output` é a cauda crua do processo e `step` são os passos já interpretados do agente (ferramenta,
// alvo, desfecho). Os dois viajam pelo mesmo canal: quem só quer saber se terminou lê `status`.
export type PromptRunEvent = {
	runId: string;
	status: "started" | "output" | "step" | "done" | "failed" | "timeout" | "cancelled";
	output?: string;
	error?: string;
	steps?: AgentStep[];
};

// A conversa de uma sessão viva. `events` carrega blocos novos ou já conhecidos que mudaram de
// estado (ferramenta que terminou, permissão respondida) — o `seq` de cada um é a identidade que o
// front usa para juntar. `busy` é o agente trabalhando; `status` só aparece quando a sessão muda.
type PubSubChannels = {
	// A central de agents publica o mapa inteiro a cada mudança: a lista é curta e o snapshot completo
	// dispensa o cliente reconstruir estado a partir de deltas depois de uma reconexão. `focus` é o
	// workspace/tab/pane na tela do kw-terminal, espelhado ao vivo pelos eventos *.focused.
	agentRadar: { agents: RadarAgent[]; focus: RadarFocus };
	terminalWorkspace: { revision: number; source: "shell" | "agent" };
	// A conversa que o CLI de um pane está gravando no disco, publicada por `paneId`.
	agentRadarTranscript: AgentRadarTranscriptEnvelope;
	agentTerminalScreen: {
		paneId: string;
		ansi: string;
		revision: number;
		cols: number;
		rows: number;
		// Linhas de histórico acima da janela publicada: 0 é o vivo, >0 é o espelho scrollado.
		offset: number;
	};
	shells: ShellStreamEvent;
	flow: FlowEvent;
	promptRun: PromptRunEvent;
	notification: {
		title: string;
		message: string;
	};
	tasks: {
		// Ausente quando o evento vem do watcher de FS (não sabe qual task mudou).
		taskId?: string;
		projectId: string;
		action: "created" | "updated" | "deleted";
		source: "api" | "cli" | "fs";
	};
	// Pedido externo de navegação: o kw-terminal manda a rota da tarefa em que o
	// agente está trabalhando e o app abre essa rota na janela aberta.
	navigate: {
		route: string;
	};
};

// Stream cru de um shell embutido: bytes do PTY em base64, título publicado pelo CLI e
// desfecho do processo. Publicado por shellId; o replay inicial não passa por aqui.
export type ShellStreamEvent =
	| { type: "data"; b64: string }
	| { type: "title"; title: string }
	| { type: "exit"; exitCode: number | null }
	| { type: "closed" };

export type TerminalEventType =
	| "session_opened"
	| "session_closed"
	| "window_opened"
	| "window_closed";

export type TerminalEvent = {
	eventType: TerminalEventType;
	projectId: string;
	taskId?: string;
	sessionName: string;
	windowName?: string;
};

const TERMINAL_CHANNEL = "terminal:global";

export const PubSub = {
	subscribe<T extends keyof PubSubChannels>(type: T, uuid: string, signal?: AbortSignal) {
		const key = `${type}:${uuid}`;

		return publisher.subscribe(key, { signal }) as AsyncIterable<PubSubChannels[T]>;
	},

	publish<T extends keyof PubSubChannels>(type: T, uuid: string, data: PubSubChannels[T]) {
		const key = `${type}:${uuid}`;

		return publisher.publish(key, data);
	},

	terminal: {
		subscribe(signal?: AbortSignal) {
			return publisher.subscribe(TERMINAL_CHANNEL, { signal }) as AsyncIterable<TerminalEvent>;
		},

		publish(data: TerminalEvent) {
			return publisher.publish(TERMINAL_CHANNEL, data);
		},
	},
};
