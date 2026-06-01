import { create } from "zustand";
import { persist } from "zustand/middleware";

const HISTORY_CAP = 15;

interface PromptBarState {
	text: string;
	expanded: boolean;
	interactWithRoute: boolean;
	history: string[];

	setText: (text: string) => void;
	setExpanded: (expanded: boolean) => void;
	toggleExpanded: () => void;
	setInteractWithRoute: (value: boolean) => void;
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
			interactWithRoute: true,
			history: [],

			setText: (text) => set({ text }),
			setExpanded: (expanded) => set({ expanded }),
			toggleExpanded: () => set((state) => ({ expanded: !state.expanded })),
			setInteractWithRoute: (interactWithRoute) => set({ interactWithRoute }),
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
				interactWithRoute: state.interactWithRoute,
				history: state.history,
			}),
		},
	),
);
