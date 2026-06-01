import { create } from "zustand";

// Abertura do switcher por clique (modo mouse), disparada pela afordância na TabBar. O ciclo por
// teclado (segurar Ctrl + Tab) é estado local do próprio componente e não passa por aqui — este
// store só carrega o gesto de mouse de um canto a outro da árvore sem prop drilling. Efêmero.
//
// `currentKey` é a sessão de doc aberta AGORA, marcada na hora (sem o dwell de 10s que gravaria no
// MRU). O switcher a filtra da lista pra nunca oferecer "o doc onde você já está" como alvo —
// começando sempre no índice 0 no doc anterior, como o Alt+Tab. Sem isso, o dwell faria `recents[0]`
// ora ser o doc atual (>10s), ora o anterior (<10s), e o offset ficaria não-determinístico.
interface DocSwitcherState {
	mouseOpen: boolean;
	currentKey: string | null;
	open: () => void;
	close: () => void;
	setCurrentKey: (key: string | null) => void;
}

export const useDocSwitcherStore = create<DocSwitcherState>((set) => ({
	mouseOpen: false,
	currentKey: null,
	open: () => set({ mouseOpen: true }),
	close: () => set({ mouseOpen: false }),
	setCurrentKey: (key) => set({ currentKey: key }),
}));
