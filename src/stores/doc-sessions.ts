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
	| { kind: "skill"; variantPath: string }
	| { kind: "agent"; variantPath: string };

export function docSessionKey(params: DocSessionParams): string {
	switch (params.kind) {
		case "task":
			return `task:${params.taskId}:${params.file}`;
		case "vault":
			return `vault:${params.projectId}:${params.fileName}`;
		case "docs":
			return `docs:${params.projectId}:${params.path}`;
		case "skill":
			return `skill:${params.variantPath}`;
		case "agent":
			return `agent:${params.variantPath}`;
	}
}

// Teto do mapa de âncoras pra não inchar o localStorage. Re-salvar reordena pro fim (LRU);
// ao exceder, descarta as mais antigas.
const ANCHOR_CAP = 200;

interface DocSessionsState {
	anchors: Record<string, HeadingAnchor>;
	getAnchor: (key: string) => HeadingAnchor | null;
	saveAnchor: (key: string, anchor: HeadingAnchor) => void;
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
		}),
		{
			name: "doc-sessions-storage",
			partialize: (state) => ({ anchors: state.anchors }),
		},
	),
);
