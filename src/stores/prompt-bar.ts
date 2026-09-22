import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
	type CodexApprovalMode,
	INVOKE_INHERIT,
	type InvokePermissionMode,
	normalizeCodexModel,
	type WorkingCli,
} from "@/constants/invoke";
import { nextImageIndex } from "@/lib/build-prompt";

// Imagem colada no textarea, já gravada em `.koworker/medias/` do projeto de origem. O `index` é a
// identidade do marcador `[Imagem N]` no texto: nasce na cola, nunca é renumerado (apagar a 1 não
// transforma a 2 em 1), e é por ele que a composição do prompt resolve o path.
export interface PromptImage {
	index: number;
	projectId: string;
	name: string;
}

// Referência leve do alvo de invocação escolhido: só kind+slug. O painel resolve o agent/skill
// completo pelas listas em cache. Vive no store (não persistido) porque Invocação e Conversa leem o
// mesmo alvo; zera na troca de projeto como o estado local fazia.
export interface InvokeSelection {
	kind: "agent" | "skill";
	slug: string;
}

export interface ClaudeSessionConfig {
	model: string;
	effort: string;
	permissionMode: InvokePermissionMode;
}

// Knobs da sessão `codex`. Sem frontmatter dono do default, tudo persiste — a escolha do usuário é a
// verdade. `inherit` significa "sem flag" (config do próprio codex manda).
export interface CodexSessionConfig {
	model: string;
	effort: string;
	approvalMode: CodexApprovalMode;
}

// Config de invocação: preferências de aba do terminal + as duas sessões lado a lado. O `cli` ativo
// (estado de topo do store) decide qual sessão o comando usa.
export interface InvokeConfig {
	// Nova aba do kw-terminal por invocação (default) vs. reaproveitar a aba do alvo.
	forceNew: boolean;
	// Dispara sem trazer a janela do terminal pra frente.
	background: boolean;
	claude: ClaudeSessionConfig;
	codex: CodexSessionConfig;
}

const DEFAULT_INVOKE: InvokeConfig = {
	forceNew: true,
	background: false,
	claude: {
		model: "opus",
		effort: "medium",
		permissionMode: "bypass",
	},
	codex: {
		model: "gpt-5.6-sol",
		effort: "medium",
		approvalMode: "bypass",
	},
};

const VALID_PERMISSION_MODES = new Set<InvokePermissionMode>([
	"bypass",
	"plan",
	"acceptEdits",
	"default",
]);

const VALID_APPROVAL_MODES = new Set<CodexApprovalMode>([
	"bypass",
	"fullAuto",
	"readOnly",
	"default",
]);

interface PromptBarState {
	text: string;
	expanded: boolean;
	// CLI de trabalho da sessão: governa o comando, os knobs de sessão exibidos e a
	// grafia das skills no prompt copiado/invocado. Persiste — é um modo de trabalho, não um detalhe.
	cli: WorkingCli;
	// Seção de invocação (Alvo + Sessão) revelada pelo trigger "Invocação". Vive abaixo do `expanded`:
	// só aparece com o prompt aberto, mas lembra o próprio estado entre sessões.
	invokeOpen: boolean;
	executeOpen: boolean;
	// Seção "Anexos" (toggles kw/rota/input) revelada pelo trigger homônimo — mesmo regime do `invokeOpen`.
	attachOpen: boolean;
	// Prefixa `/kw` na cabeça do prompt — a skill koworker viaja junto com a invocação/cópia.
	interactWithKw: boolean;
	interactWithRoute: boolean;
	interactWithInput: boolean;
	// Imagens coladas/anexadas ao rascunho — persiste junto com o texto (os marcadores continuam lá).
	images: PromptImage[];
	// Alvo de invocação corrente (agent/skill), compartilhado entre Invocação e Conversa. Não persiste.
	selection: InvokeSelection | null;
	invoke: InvokeConfig;

	setText: (text: string) => void;
	setExpanded: (expanded: boolean) => void;
	toggleExpanded: () => void;
	setCli: (cli: WorkingCli) => void;
	toggleInvokeOpen: () => void;
	setExecuteOpen: (open: boolean) => void;
	toggleExecuteOpen: () => void;
	toggleAttachOpen: () => void;
	setAllSectionsOpen: (open: boolean) => void;
	setSelection: (selection: InvokeSelection | null) => void;
	setInteractWithKw: (value: boolean) => void;
	setInteractWithRoute: (value: boolean) => void;
	setInteractWithInput: (value: boolean) => void;
	patchInvoke: (patch: Partial<Pick<InvokeConfig, "forceNew" | "background">>) => void;
	patchClaudeSession: (patch: Partial<ClaudeSessionConfig>) => void;
	patchCodexSession: (patch: Partial<CodexSessionConfig>) => void;
	// Registra uma imagem já salva em medias/ e devolve o índice do marcador que a referencia.
	addImage: (image: { projectId: string; name: string }) => number;
	// Lista de imagens do rascunho — o `PromptField` é quem a mantém em dia com os marcadores do texto.
	setImages: (images: PromptImage[]) => void;
	clear: () => void;
	// Insere `text` em nova linha no fim do rascunho e abre o footer (mention de título do .md).
	appendMention: (text: string) => void;
}

// O persist grava síncrono a cada `set` — na digitação isso serializava e escrevia o rascunho
// inteiro no localStorage a cada tecla, no meio do frame. O debounce adia a escrita pro repouso;
// `pagehide` descarrega o pendente pra fechar a aba não perder o fim do rascunho.
const DRAFT_FLUSH_MS = 300;

let pendingDraft: { name: string; value: string } | null = null;
let draftTimer: ReturnType<typeof setTimeout> | null = null;

function flushDraft() {
	if (!pendingDraft) return;
	localStorage.setItem(pendingDraft.name, pendingDraft.value);
	pendingDraft = null;
}

if (typeof window !== "undefined") {
	window.addEventListener("pagehide", flushDraft);
}

const draftStorage = {
	getItem: (name: string) => localStorage.getItem(name),
	setItem: (name: string, value: string) => {
		pendingDraft = { name, value };
		if (draftTimer) clearTimeout(draftTimer);
		draftTimer = setTimeout(flushDraft, DRAFT_FLUSH_MS);
	},
	removeItem: (name: string) => {
		pendingDraft = null;
		localStorage.removeItem(name);
	},
};

export const usePromptBarStore = create<PromptBarState>()(
	persist(
		(set, get) => ({
			text: "",
			expanded: false,
			cli: "claude",
			invokeOpen: false,
			executeOpen: false,
			attachOpen: false,
			interactWithKw: true,
			interactWithRoute: true,
			interactWithInput: true,
			images: [],
			selection: null,
			invoke: DEFAULT_INVOKE,

			setText: (text) => set({ text }),
			setExpanded: (expanded) => set({ expanded }),
			toggleExpanded: () => set((state) => ({ expanded: !state.expanded })),
			setCli: (cli) => set({ cli }),
			toggleInvokeOpen: () => set((state) => ({ invokeOpen: !state.invokeOpen })),
			setExecuteOpen: (executeOpen) => set({ executeOpen }),
			toggleExecuteOpen: () => set((state) => ({ executeOpen: !state.executeOpen })),
			toggleAttachOpen: () => set((state) => ({ attachOpen: !state.attachOpen })),
			setAllSectionsOpen: (open) => set({ attachOpen: open, invokeOpen: open, executeOpen: open }),
			setSelection: (selection) => set({ selection }),
			setInteractWithKw: (interactWithKw) => set({ interactWithKw }),
			setInteractWithRoute: (interactWithRoute) => set({ interactWithRoute }),
			setInteractWithInput: (interactWithInput) => set({ interactWithInput }),
			patchInvoke: (patch) => set((state) => ({ invoke: { ...state.invoke, ...patch } })),
			patchClaudeSession: (patch) =>
				set((state) => ({
					invoke: { ...state.invoke, claude: { ...state.invoke.claude, ...patch } },
				})),
			patchCodexSession: (patch) =>
				set((state) => ({
					invoke: { ...state.invoke, codex: { ...state.invoke.codex, ...patch } },
				})),
			addImage: (image) => {
				const index = nextImageIndex(get().images);
				set((state) => ({ images: [...state.images, { ...image, index }] }));
				return index;
			},

			setImages: (images) => set({ images }),

			// A borracha limpa o rascunho inteiro: texto e imagens anexadas caem juntos (os marcadores
			// morariam no texto apagado). Os arquivos ficam em medias/ — remover mídia é ação da /media.
			clear: () => set({ text: "", images: [] }),

			appendMention: (mention) =>
				set((state) => {
					const trimmed = mention.trim();
					if (!trimmed) return state;
					const needsBreak = state.text.length > 0 && !state.text.endsWith("\n");
					const next = `${state.text}${needsBreak ? "\n" : ""}${trimmed}\n`;
					return { text: next, expanded: true };
				}),
		}),
		{
			name: "kowork-prompt-bar",
			version: 1,
			migrate: (persisted) => {
				const saved = (persisted ?? {}) as Partial<PromptBarState>;
				if (!saved.invoke) {
					return saved;
				}

				const claude = { ...saved.invoke.claude };
				const codex = { ...saved.invoke.codex };
				if (!claude.model || claude.model === INVOKE_INHERIT) {
					claude.model = DEFAULT_INVOKE.claude.model;
				}
				if (!claude.effort || claude.effort === INVOKE_INHERIT) {
					claude.effort = DEFAULT_INVOKE.claude.effort;
				}
				if (!codex.model || codex.model === INVOKE_INHERIT) {
					codex.model = DEFAULT_INVOKE.codex.model;
				}
				if (!codex.effort || codex.effort === INVOKE_INHERIT) {
					codex.effort = DEFAULT_INVOKE.codex.effort;
				}

				return { ...saved, invoke: { ...saved.invoke, claude, codex } };
			},
			storage: createJSONStorage(() => draftStorage),
			partialize: (state) => ({
				text: state.text,
				expanded: state.expanded,
				cli: state.cli,
				invokeOpen: state.invokeOpen,
				executeOpen: state.executeOpen,
				attachOpen: state.attachOpen,
				interactWithKw: state.interactWithKw,
				interactWithRoute: state.interactWithRoute,
				interactWithInput: state.interactWithInput,
				images: state.images,
				invoke: state.invoke,
			}),
			// O shape do `invoke` mudou (sessões aninhadas) e campos novos surgiram; o merge reconstrói a
			// partir dos defaults e valida os modos salvos — estado persistido antigo (flat) simplesmente
			// cai nos defaults.
			merge: (persisted, current) => {
				const saved = (persisted ?? {}) as Partial<PromptBarState>;
				const invoke: InvokeConfig = {
					...DEFAULT_INVOKE,
					...(typeof saved.invoke?.forceNew === "boolean"
						? { forceNew: saved.invoke.forceNew }
						: {}),
					...(typeof saved.invoke?.background === "boolean"
						? { background: saved.invoke.background }
						: {}),
					claude: { ...DEFAULT_INVOKE.claude, ...saved.invoke?.claude },
					codex: { ...DEFAULT_INVOKE.codex, ...saved.invoke?.codex },
				};
				if (!VALID_PERMISSION_MODES.has(invoke.claude.permissionMode)) {
					invoke.claude.permissionMode = DEFAULT_INVOKE.claude.permissionMode;
				}
				if (!VALID_APPROVAL_MODES.has(invoke.codex.approvalMode)) {
					invoke.codex.approvalMode = DEFAULT_INVOKE.codex.approvalMode;
				}
				invoke.codex.model = normalizeCodexModel(invoke.codex.model);
				const cli: WorkingCli = saved.cli === "codex" || saved.cli === "pi" ? saved.cli : "claude";
				const images = Array.isArray(saved.images) ? saved.images : [];
				return {
					...current,
					...saved,
					cli,
					invoke,
					images,
				};
			},
		},
	),
);
