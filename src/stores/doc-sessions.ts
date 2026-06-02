import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { HeadingAnchor } from "@/lib/heading-anchor";

// Identidade estável de um documento, independente da URL. A âncora de leitura é indexada por esta
// chave — assim mover o arquivo ativo da tarefa pra URL (Slice B) não invalida a memória de scroll.
// É a chave central compartilhada por todas as superfícies de doc (tarefa/vault/docs/skill).
export type DocSessionParams =
	| { kind: "task"; taskId: string; file: string }
	| { kind: "vault"; projectId: string; fileName: string }
	| { kind: "docs"; projectId: string; path: string }
	| { kind: "skill"; projectName: string; variantPath: string };

export function docSessionKey(params: DocSessionParams): string {
	switch (params.kind) {
		case "task":
			return `task:${params.taskId}:${params.file}`;
		case "vault":
			return `vault:${params.projectId}:${params.fileName}`;
		case "docs":
			return `docs:${params.projectId}:${params.path}`;
		case "skill":
			return `skill:${params.projectName}:${params.variantPath}`;
	}
}

// Entrada no MRU (most-recently-used) de sessões — alimenta o switcher Ctrl+Tab. `nav` reconstrói a
// rota; `projectId` restaura o foco de projeto nas superfícies que dependem dele (vault/skill) e não
// da URL. A âncora de leitura não vive aqui: o switcher a lê do mapa `anchors` pela mesma `key`.
export type DocSessionMeta = {
	key: string;
	kind: DocSessionParams["kind"];
	title: string;
	// Linha secundária no card: nome do arquivo (tarefa/vault), slug (skill) ou diretório (docs).
	subtitle?: string;
	projectName?: string;
	projectId?: string;
	// Ícone próprio da skill (nome lucide + cor); nas outras superfícies o card usa o ícone do kind.
	icon?: string;
	iconColor?: string;
	nav: { to: string; params: Record<string, string> };
	lastVisited: number;
	// Fixada manualmente: nunca expira pelo teto e sobrevive ao "Limpar recentes".
	pinned?: boolean;
};

// Inverso parcial de `docSessionKey`, só pro agrupamento do switcher: arquivos da mesma tarefa
// compartilham o taskId entre os dois primeiros `:`. As outras superfícies não têm entidade-pai e
// entram como cards soltos, então devolvem null.
function taskIdFromKey(key: string): string | null {
	if (!key.startsWith("task:")) {
		return null;
	}
	const rest = key.slice("task:".length);
	const sep = rest.indexOf(":");
	return sep === -1 ? null : rest.slice(0, sep);
}

export type SessionGroupCard = DocSessionMeta & { isCurrent: boolean };

// Um bloco dentro de um projeto: uma tarefa com seus arquivos, ou um doc avulso (vault/docs/skill).
export type SessionBlock =
	| { type: "task"; taskId: string; title: string; cards: SessionGroupCard[] }
	| { type: "doc"; card: SessionGroupCard };

export type SessionProjectGroup = { projectName: string | null; blocks: SessionBlock[] };

// Agrupa o MRU pro switcher em projeto → (tarefa com seus arquivos | doc avulso) → cards. A entrada
// já vem em ordem MRU (mais recente primeiro), então a primeira aparição de cada projeto/tarefa/card
// define a ordem — o trabalho mais recente flutua pro topo. `cards` é a mesma sequência achatada na
// ordem em que é renderizada: é por ela que o teclado cicla.
export function groupSessions(
	list: DocSessionMeta[],
	currentKey: string | null,
): { groups: SessionProjectGroup[]; cards: SessionGroupCard[] } {
	const groups: SessionProjectGroup[] = [];
	const byProject = new Map<string | null, SessionProjectGroup>();
	// Chaveado só pelo taskId: uma tarefa pertence a um único projeto, sem colisão entre eles.
	const byTask = new Map<string, Extract<SessionBlock, { type: "task" }>>();

	for (const meta of list) {
		const card: SessionGroupCard = { ...meta, isCurrent: meta.key === currentKey };
		const projectName = meta.projectName ?? null;

		let group = byProject.get(projectName);
		if (!group) {
			group = { projectName, blocks: [] };
			byProject.set(projectName, group);
			groups.push(group);
		}

		const taskId = taskIdFromKey(meta.key);
		if (!taskId) {
			group.blocks.push({ type: "doc", card });
			continue;
		}

		let block = byTask.get(taskId);
		if (!block) {
			block = { type: "task", taskId, title: meta.title, cards: [] };
			byTask.set(taskId, block);
			group.blocks.push(block);
		}
		block.cards.push(card);
	}

	const cards = groups.flatMap((group) =>
		group.blocks.flatMap((block) => (block.type === "task" ? block.cards : [block.card])),
	);
	return { groups, cards };
}

// Índice inicial da seleção do teclado no switcher: o doc anterior — o primeiro não-atual na ordem MRU
// — mapeado pra sua posição na sequência agrupada. O agrupamento reordena, então "primeiro não-atual
// na ordem de render" não serve: seria um doc mais velho do mesmo projeto. Isto preserva o flick-pro-
// anterior do Alt+Tab. Cai em 0 se a lista só tiver a sessão atual (o switcher não abre nesse caso).
export function initialSwitcherIndex(list: DocSessionMeta[], currentKey: string | null): number {
	const { cards } = groupSessions(list, currentKey);
	const previousKey = list.find((r) => r.key !== currentKey)?.key;
	const index = cards.findIndex((c) => c.key === previousKey);
	return Math.max(index, 0);
}

// Teto do mapa de âncoras pra não inchar o localStorage. Re-salvar reordena pro fim (LRU);
// ao exceder, descarta as mais antigas.
const ANCHOR_CAP = 200;

// O switcher só mostra um punhado de sessões; manter a lista curta evita inchar o storage. O teto
// vale só pras automáticas: fixadas ficam sempre (custo é deliberado), então a lista pode passar de
// 12 quando há muitas pinadas.
const RECENTS_CAP = 12;

// Mantém a ordem MRU; ao exceder o teto, descarta as não-fixadas mais antigas (do fim) até caber.
function capRecents(list: DocSessionMeta[]): DocSessionMeta[] {
	if (list.length <= RECENTS_CAP) {
		return list;
	}
	const next = [...list];
	for (let i = next.length - 1; i >= 0 && next.length > RECENTS_CAP; i--) {
		if (!next[i].pinned) {
			next.splice(i, 1);
		}
	}
	return next;
}

interface DocSessionsState {
	anchors: Record<string, HeadingAnchor>;
	getAnchor: (key: string) => HeadingAnchor | null;
	saveAnchor: (key: string, anchor: HeadingAnchor) => void;
	recents: DocSessionMeta[];
	recordVisit: (meta: Omit<DocSessionMeta, "lastVisited">) => void;
	togglePin: (key: string) => void;
	removeRecent: (key: string) => void;
	// Remove todas as sessões cuja chave começa por `prefix` — uma tarefa tem uma sessão por arquivo.
	removeRecentsByPrefix: (prefix: string) => void;
	// Limpa só as automáticas; fixadas permanecem (é o propósito de fixar).
	clearLoose: () => void;
}

export const useDocSessionsStore = create<DocSessionsState>()(
	persist(
		(set, get) => ({
			anchors: {},
			getAnchor: (key) => get().anchors[key] ?? null,
			saveAnchor: (key, anchor) =>
				set((state) => {
					const next: Record<string, HeadingAnchor> = {};
					for (const [existing, value] of Object.entries(state.anchors)) {
						if (existing !== key) {
							next[existing] = value;
						}
					}
					next[key] = anchor;

					const keys = Object.keys(next);
					if (keys.length > ANCHOR_CAP) {
						for (const stale of keys.slice(0, keys.length - ANCHOR_CAP)) {
							delete next[stale];
						}
					}

					return { anchors: next };
				}),
			recents: [],
			recordVisit: (meta) =>
				set((state) => {
					// Re-gravar preserva o pin: o dwell não deve desfixar uma sessão fixada.
					const prev = state.recents.find((r) => r.key === meta.key);
					const entry: DocSessionMeta = {
						...meta,
						pinned: prev?.pinned ?? false,
						lastVisited: Date.now(),
					};
					const next = [entry, ...state.recents.filter((r) => r.key !== meta.key)];
					return { recents: capRecents(next) };
				}),
			togglePin: (key) =>
				set((state) => ({
					recents: state.recents.map((r) => (r.key === key ? { ...r, pinned: !r.pinned } : r)),
				})),
			removeRecent: (key) =>
				set((state) => ({ recents: state.recents.filter((r) => r.key !== key) })),
			removeRecentsByPrefix: (prefix) =>
				set((state) => ({ recents: state.recents.filter((r) => !r.key.startsWith(prefix)) })),
			clearLoose: () => set((state) => ({ recents: state.recents.filter((r) => r.pinned) })),
		}),
		{
			name: "doc-sessions-storage",
			partialize: (state) => ({ anchors: state.anchors, recents: state.recents }),
		},
	),
);
