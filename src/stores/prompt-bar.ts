import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
	type CodexApprovalMode,
	INVOKE_INHERIT,
	type InvokeCli,
	type InvokePermissionMode,
} from "@/constants/invoke";
import type { PromptTemplateSlug } from "@/constants/prompt-templates";
import type { PromptEngine, PromptEngineEffort } from "@/api/schemas/prompt";
import { imagePlaceholder } from "@/lib/build-prompt";

// Imagem colada no textarea, já gravada em `.koworker/medias/` do projeto de origem. O `index` é a
// identidade do marcador `[Imagem N]` no texto: nasce na cola, nunca é renumerado (apagar a 1 não
// transforma a 2 em 1), e é por ele que a composição do prompt resolve o path.
export interface PromptImage {
	index: number;
	projectId: string;
	name: string;
}

// Referência leve do alvo de invocação escolhido: só kind+slug. O painel resolve o agent/skill
// completo pelas listas em cache. Vive no store (não persistido) pra que o autofill possa pré-marcar
// um alvo de fora do painel; zera na troca de projeto como o estado local fazia.
export interface InvokeSelection {
	kind: "agent" | "skill";
	slug: string;
}

// Knobs da sessão `claude`. `permissionMode` é a preferência favorita e persiste; `model`/`effort`
// NÃO persistem: o painel os semeia do frontmatter do alvo a cada invocação (o dono do default é o
// .md), então `inherit` aqui significa "sem flag".
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
	// Nova aba tmux por invocação (default) vs. reaproveitar a aba do alvo.
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
		model: INVOKE_INHERIT,
		effort: INVOKE_INHERIT,
		permissionMode: "bypass",
	},
	codex: {
		model: INVOKE_INHERIT,
		effort: INVOKE_INHERIT,
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
	// CLI de trabalho da sessão (claude|codex): governa o comando, os knobs de sessão exibidos e a
	// grafia das skills no prompt copiado/invocado. Persiste — é um modo de trabalho, não um detalhe.
	cli: InvokeCli;
	// Seção de invocação (Alvo + Sessão) revelada pelo trigger "Invocação". Vive abaixo do `expanded`:
	// só aparece com o prompt aberto, mas lembra o próprio estado entre sessões.
	invokeOpen: boolean;
	executeOpen: boolean;
	// Seção "Anexos" (toggles kw/rota/input) revelada pelo trigger homônimo — mesmo regime do `invokeOpen`.
	attachOpen: boolean;
	// Seção "Estruturação" (estrutura Goal/Contexto/... + autofill) revelada pelo trigger homônimo.
	structureOpen: boolean;
	// Template ativo (slug em PROMPT_TEMPLATES); null = prompt sem estrutura.
	structureTemplate: string | null;
	// Rascunho dos campos por template e por campo — trocar de template preserva o que já foi digitado.
	structureValues: Record<string, Record<string, string>>;
	// Prefixa `/kw` na cabeça do prompt — a skill koworker viaja junto com a invocação/cópia.
	interactWithKw: boolean;
	interactWithRoute: boolean;
	interactWithInput: boolean;
	// Imagens coladas/anexadas ao rascunho — persiste junto com o texto (os marcadores continuam lá).
	images: PromptImage[];
	// Alvo de invocação corrente (agent/skill), compartilhado entre o painel e o autofill. Não persiste.
	selection: InvokeSelection | null;
	// Motor/esforço do autofill de estrutura — preferência do usuário, persiste.
	autofillEngine: PromptEngine;
	autofillEffort: PromptEngineEffort;
	// Autofill em voo: o painel de anexos mostra skeletons enquanto true. Não persiste.
	autofillPending: boolean;
	invoke: InvokeConfig;

	setText: (text: string) => void;
	setExpanded: (expanded: boolean) => void;
	toggleExpanded: () => void;
	setCli: (cli: InvokeCli) => void;
	setInvokeOpen: (open: boolean) => void;
	toggleInvokeOpen: () => void;
	setExecuteOpen: (open: boolean) => void;
	toggleExecuteOpen: () => void;
	toggleAttachOpen: () => void;
	toggleStructureOpen: () => void;
	setAllSectionsOpen: (open: boolean) => void;
	setStructureTemplate: (slug: string | null) => void;
	// Escreve um campo do template ativo; sem template ativo, não faz nada.
	setStructureField: (field: string, value: string) => void;
	// Descarta o rascunho de campos do template ativo.
	clearStructureFields: () => void;
	// Aplica o resultado do autofill: adota a estrutura só se nenhuma escolhida (a menos de `force`,
	// que troca a estrutura e repreenche tudo) e escreve campos só onde vazio — texto digitado nunca é
	// sobrescrito, salvo em `force`.
	applyStructureAutofill: (params: {
		structure: PromptTemplateSlug;
		fields: Record<string, string>;
		force: boolean;
	}) => void;
	setSelection: (selection: InvokeSelection | null) => void;
	setAutofillEngine: (engine: PromptEngine) => void;
	setAutofillEffort: (effort: PromptEngineEffort) => void;
	setAutofillPending: (pending: boolean) => void;
	setInteractWithKw: (value: boolean) => void;
	setInteractWithRoute: (value: boolean) => void;
	setInteractWithInput: (value: boolean) => void;
	patchInvoke: (patch: Partial<Pick<InvokeConfig, "forceNew" | "background">>) => void;
	patchClaudeSession: (patch: Partial<ClaudeSessionConfig>) => void;
	patchCodexSession: (patch: Partial<CodexSessionConfig>) => void;
	// Registra uma imagem já salva em medias/ e devolve o índice do marcador que a referencia.
	addImage: (image: { projectId: string; name: string }) => number;
	// Solta a imagem do rascunho (o arquivo fica em medias/) e apaga os marcadores dela do texto.
	removeImage: (index: number) => void;
	// Descarta imagens cujo marcador não está mais no texto — o texto é o dono da presença do token,
	// então recortar/selecionar-apagar/editar o marcador tira a imagem junto. O arquivo fica em medias/.
	reconcileImages: (text: string) => void;
	restoreDraft: (draft: { text: string; images: PromptImage[] }) => void;
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
			structureOpen: false,
			structureTemplate: null,
			structureValues: {},
			interactWithKw: true,
			interactWithRoute: true,
			interactWithInput: true,
			images: [],
			selection: null,
			autofillEngine: "opus",
			autofillEffort: "medium",
			autofillPending: false,
			invoke: DEFAULT_INVOKE,

			setText: (text) => set({ text }),
			setExpanded: (expanded) => set({ expanded }),
			toggleExpanded: () => set((state) => ({ expanded: !state.expanded })),
			setCli: (cli) => set({ cli }),
			setInvokeOpen: (invokeOpen) => set({ invokeOpen }),
			toggleInvokeOpen: () => set((state) => ({ invokeOpen: !state.invokeOpen })),
			setExecuteOpen: (executeOpen) => set({ executeOpen }),
			toggleExecuteOpen: () => set((state) => ({ executeOpen: !state.executeOpen })),
			toggleAttachOpen: () => set((state) => ({ attachOpen: !state.attachOpen })),
			toggleStructureOpen: () => set((state) => ({ structureOpen: !state.structureOpen })),
			setAllSectionsOpen: (open) =>
				set({ attachOpen: open, structureOpen: open, invokeOpen: open, executeOpen: open }),
			setStructureTemplate: (structureTemplate) => set({ structureTemplate }),

			setStructureField: (field, value) =>
				set((state) => {
					if (!state.structureTemplate) return state;
					const current = state.structureValues[state.structureTemplate] ?? {};
					return {
						structureValues: {
							...state.structureValues,
							[state.structureTemplate]: { ...current, [field]: value },
						},
					};
				}),

			clearStructureFields: () =>
				set((state) => {
					if (!state.structureTemplate) return state;
					const structureValues = { ...state.structureValues };
					delete structureValues[state.structureTemplate];
					return { structureValues };
				}),

			applyStructureAutofill: ({ structure, fields, force }) =>
				set((state) => {
					const structureTemplate = force ? structure : (state.structureTemplate ?? structure);
					const base = force ? {} : (state.structureValues[structure] ?? {});
					const values = { ...base };
					for (const [key, value] of Object.entries(fields)) {
						if (force || !values[key]?.trim()) {
							values[key] = value;
						}
					}
					return {
						structureTemplate,
						structureValues: { ...state.structureValues, [structure]: values },
					};
				}),

			setSelection: (selection) => set({ selection }),
			setAutofillEngine: (autofillEngine) => set({ autofillEngine }),
			setAutofillEffort: (autofillEffort) => set({ autofillEffort }),
			setAutofillPending: (autofillPending) => set({ autofillPending }),
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
				const index = get().images.reduce((max, entry) => Math.max(max, entry.index), 0) + 1;
				set((state) => ({ images: [...state.images, { ...image, index }] }));
				return index;
			},

			removeImage: (index) =>
				set((state) => ({
					images: state.images.filter((image) => image.index !== index),
					text: state.text.replaceAll(imagePlaceholder(index), "").trim(),
				})),

			reconcileImages: (text) =>
				set((state) => {
					const kept = state.images.filter((image) => text.includes(imagePlaceholder(image.index)));
					return kept.length === state.images.length ? state : { images: kept };
				}),

			restoreDraft: ({ text, images }) => set({ text, images }),

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
			storage: createJSONStorage(() => draftStorage),
			partialize: (state) => ({
				text: state.text,
				expanded: state.expanded,
				cli: state.cli,
				invokeOpen: state.invokeOpen,
				executeOpen: state.executeOpen,
				attachOpen: state.attachOpen,
				structureOpen: state.structureOpen,
				structureTemplate: state.structureTemplate,
				structureValues: state.structureValues,
				interactWithKw: state.interactWithKw,
				interactWithRoute: state.interactWithRoute,
				interactWithInput: state.interactWithInput,
				images: state.images,
				autofillEngine: state.autofillEngine,
				autofillEffort: state.autofillEffort,
				// model/effort do claude não persistem: são semeados do alvo a cada invocação. Salvos
				// sempre como `inherit` pra não grudar o default de um .md no favorito global. O codex
				// persiste inteiro — a escolha do usuário é o único dono.
				invoke: {
					...state.invoke,
					claude: { ...state.invoke.claude, model: INVOKE_INHERIT, effort: INVOKE_INHERIT },
				},
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
				const cli: InvokeCli = saved.cli === "codex" ? "codex" : "claude";
				const images = Array.isArray(saved.images) ? saved.images : [];
				return { ...current, ...saved, cli, invoke, images };
			},
		},
	),
);
