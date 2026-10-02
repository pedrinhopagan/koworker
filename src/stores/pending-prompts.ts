import { create } from "zustand";

import type { PendingPrompt } from "@/lib/agent-prompt-receipt";

type PendingPromptsStore = {
	prompts: Record<string, PendingPrompt[]>;
	add: (paneId: string, prompt: PendingPrompt) => void;
	remove: (paneId: string, ids: string[]) => void;
};

export const NO_PENDING_PROMPTS: PendingPrompt[] = [];

export const usePendingPrompts = create<PendingPromptsStore>((set) => ({
	prompts: {},
	add(paneId, prompt) {
		set((state) => ({
			prompts: { ...state.prompts, [paneId]: [...(state.prompts[paneId] ?? []), prompt] },
		}));
	},
	remove(paneId, ids) {
		set((state) => {
			const remaining = (state.prompts[paneId] ?? []).filter((prompt) => !ids.includes(prompt.id));
			const { [paneId]: _removed, ...prompts } = state.prompts;

			return { prompts: remaining.length > 0 ? { ...prompts, [paneId]: remaining } : prompts };
		});
	},
}));
