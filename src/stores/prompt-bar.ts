import { create } from "zustand";
import { persist } from "zustand/middleware";

import { INVOKE_INHERIT, type InvokePermissionMode } from "@/constants/invoke";

const HISTORY_CAP = 15;

// Flags de sessão `claude` que viajam junto com a invocação de agent/skill — espelham 1:1 o que o
// comando de terminal aceita. `permissionMode`/`forceNew`/`background` são a preferência favorita do
// usuário e persistem. `model`/`effort` NÃO persistem: o painel os semeia do frontmatter do alvo a
// cada invocação (o dono do default é o .md), então `inherit` aqui significa "sem flag".
export interface InvokeConfig {
	model: string;
	effort: string;
	permissionMode: InvokePermissionMode;
	// Nova aba tmux por invocação (default) vs. reaproveitar a aba do alvo.
	forceNew: boolean;
	// Dispara sem trazer a janela do terminal pra frente.
	background: boolean;
}

const DEFAULT_INVOKE: InvokeConfig = {
	model: INVOKE_INHERIT,
	effort: INVOKE_INHERIT,
	permissionMode: "bypass",
	forceNew: true,
	background: false,
};

const VALID_PERMISSION_MODES = new Set<InvokePermissionMode>([
	"bypass",
	"plan",
	"acceptEdits",
	"default",
]);

interface PromptBarState {
	text: string;
	expanded: boolean;
	// Seção de invocação (alvo + knobs) revelada pelo botão robô na linha de ações. Vive abaixo do
	// `expanded`: só aparece com o prompt aberto, mas lembra o próprio estado entre sessões.
	invokeOpen: boolean;
	// Prefixa `/kw` na cabeça do prompt — a skill koworker viaja junto com a invocação/cópia.
	interactWithKw: boolean;
	interactWithRoute: boolean;
	interactWithInput: boolean;
	invoke: InvokeConfig;
	history: string[];

	setText: (text: string) => void;
	setExpanded: (expanded: boolean) => void;
	toggleExpanded: () => void;
	setInvokeOpen: (open: boolean) => void;
	toggleInvokeOpen: () => void;
	setInteractWithKw: (value: boolean) => void;
	setInteractWithRoute: (value: boolean) => void;
	setInteractWithInput: (value: boolean) => void;
	patchInvoke: (patch: Partial<InvokeConfig>) => void;
	clear: () => void;
	// Insere `text` em nova linha no fim do rascunho e abre o footer (mention de título do .md).
	appendMention: (text: string) => void;
	// Empilha no topo do histórico, deduplicando e ignorando vazio.
	pushHistory: (text: string) => void;
}

export const usePromptBarStore = create<PromptBarState>()(
	persist(
		(set) => ({
			text: "",
			expanded: false,
			invokeOpen: false,
			interactWithKw: true,
			interactWithRoute: true,
			interactWithInput: true,
			invoke: DEFAULT_INVOKE,
			history: [],

			setText: (text) => set({ text }),
			setExpanded: (expanded) => set({ expanded }),
			toggleExpanded: () => set((state) => ({ expanded: !state.expanded })),
			setInvokeOpen: (invokeOpen) => set({ invokeOpen }),
			toggleInvokeOpen: () => set((state) => ({ invokeOpen: !state.invokeOpen })),
			setInteractWithKw: (interactWithKw) => set({ interactWithKw }),
			setInteractWithRoute: (interactWithRoute) => set({ interactWithRoute }),
			setInteractWithInput: (interactWithInput) => set({ interactWithInput }),
			patchInvoke: (patch) => set((state) => ({ invoke: { ...state.invoke, ...patch } })),
			clear: () => set({ text: "" }),

			appendMention: (mention) =>
				set((state) => {
					const trimmed = mention.trim();
					if (!trimmed) return state;
					const needsBreak = state.text.length > 0 && !state.text.endsWith("\n");
					const next = `${state.text}${needsBreak ? "\n" : ""}${trimmed}\n`;
					return { text: next, expanded: true };
				}),

			pushHistory: (entry) =>
				set((state) => {
					const trimmed = entry.trim();
					if (!trimmed) return state;
					const history = [trimmed, ...state.history.filter((item) => item !== trimmed)].slice(
						0,
						HISTORY_CAP,
					);
					return { history };
				}),
		}),
		{
			name: "kowork-prompt-bar",
			partialize: (state) => ({
				text: state.text,
				expanded: state.expanded,
				invokeOpen: state.invokeOpen,
				interactWithKw: state.interactWithKw,
				interactWithRoute: state.interactWithRoute,
				interactWithInput: state.interactWithInput,
				// model/effort não persistem: são semeados do alvo a cada invocação. Salvo sempre como
				// `inherit` pra não grudar o default de um .md no favorito global entre sessões.
				invoke: { ...state.invoke, model: INVOKE_INHERIT, effort: INVOKE_INHERIT },
				history: state.history,
			}),
			// `invoke` ganhou campos novos; merge raso garante defaults pra estado persistido antigo.
			// `permissionMode` salvo por uma versão antiga (ou corrompido) volta pro default seguro — a
			// allowlist do Rust já protege, mas isso mantém o select e o preview coerentes.
			merge: (persisted, current) => {
				const saved = (persisted ?? {}) as Partial<PromptBarState>;
				const invoke = { ...DEFAULT_INVOKE, ...saved.invoke };
				if (!VALID_PERMISSION_MODES.has(invoke.permissionMode)) {
					invoke.permissionMode = DEFAULT_INVOKE.permissionMode;
				}
				return { ...current, ...saved, invoke };
			},
		},
	),
);
