import { create } from "zustand";

import type { DocSessionMeta } from "./doc-sessions";

// Abertura do switcher por clique (modo mouse), disparada pela afordância na TabBar. O ciclo por
// teclado (segurar Ctrl + Tab) é estado local do próprio componente e não passa por aqui — este
// store só carrega o gesto de mouse de um canto a outro da árvore sem prop drilling. Efêmero.
//
// `current` é a sessão de doc aberta AGORA, marcada na hora (sem o dwell de 10s que gravaria no MRU).
// O switcher a usa pra DOIS fins: mostrá-la sempre como card "Sessão atual" (mesmo antes do dwell, daí
// guardar o meta inteiro e não só a chave) e começar a seleção do teclado no doc anterior — nunca no
// atual, como o Alt+Tab. Sem isso, o dwell faria `recents[0]` ora ser o atual (>10s), ora o anterior
// (<10s), e o offset inicial ficaria não-determinístico.
//
// `currentRecordAt` é o instante em que o dwell grava a sessão atual no MRU "pra valer". Enquanto não
// chega, o card da sessão atual mostra a contagem regressiva até lá.
type CurrentSessionInput = Omit<DocSessionMeta, "lastVisited" | "pinned">;

interface DocSwitcherState {
	mouseOpen: boolean;
	current: DocSessionMeta | null;
	currentRecordAt: number | null;
	open: () => void;
	close: () => void;
	setCurrent: (meta: CurrentSessionInput | null, dwellMs?: number) => void;
}

export const useDocSwitcherStore = create<DocSwitcherState>((set) => ({
	mouseOpen: false,
	current: null,
	currentRecordAt: null,
	open: () => set({ mouseOpen: true }),
	close: () => set({ mouseOpen: false }),
	setCurrent: (meta, dwellMs = 0) => {
		const now = Date.now();
		set({
			current: meta ? { ...meta, lastVisited: now, pinned: false } : null,
			currentRecordAt: meta ? now + dwellMs : null,
		});
	},
}));
