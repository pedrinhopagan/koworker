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
			clearLoose: () => set((state) => ({ recents: state.recents.filter((r) => r.pinned) })),
		}),
		{
			name: "doc-sessions-storage",
			partialize: (state) => ({ anchors: state.anchors, recents: state.recents }),
		},
	),
);
