import { create } from "zustand";

import type { InvokeCli } from "@/constants/invoke";

// Conversa em trânsito de um pane para outro (modelo trocado, CLI trocada). Vive fora da tela da
// conversa porque é a página `/shells` que manda na URL: enquanto a mudança está pendente ela segura
// a aba atual em vez de cair na lista quando o pane antigo some, e navega assim que o novo entra.
export type PaneMove = {
	cli: InvokeCli;
	// `reopen`: a mesma conversa reabre com outro modelo; `handoff`: muda de CLI com resumo.
	kind: "reopen" | "handoff";
	// Chave do pane de destino (`agent:<paneId>`); nula enquanto a migração ainda não o criou.
	to: string | null;
	startedAt: number;
};

type PaneMovesStore = {
	moves: Record<string, PaneMove>;
	begin: (from: string, cli: InvokeCli, kind: PaneMove["kind"]) => void;
	land: (from: string, to: string) => void;
	clear: (from: string) => void;
};

// Migração que nunca termina (backend caiu no meio) não pode prender a tela para sempre.
export const PANE_MOVE_MAX_AGE_MS = 10 * 60_000;

export const usePaneMoves = create<PaneMovesStore>((set) => ({
	moves: {},
	begin(from, cli, kind) {
		set((state) => ({
			moves: { ...state.moves, [from]: { cli, kind, to: null, startedAt: Date.now() } },
		}));
	},
	land(from, to) {
		set((state) => ({
			moves: {
				...state.moves,
				[from]: {
					cli: state.moves[from]?.cli ?? "claude",
					kind: state.moves[from]?.kind ?? "reopen",
					to,
					startedAt: Date.now(),
				},
			},
		}));
	},
	clear(from) {
		set((state) => {
			const { [from]: _removed, ...moves } = state.moves;

			return { moves };
		});
	},
}));

export function activePaneMove(moves: Record<string, PaneMove>, from: string | undefined) {
	const move = from ? moves[from] : undefined;
	if (!move || Date.now() - move.startedAt > PANE_MOVE_MAX_AGE_MS) {
		return null;
	}

	return move;
}
