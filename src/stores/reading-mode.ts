import { create } from "zustand";

// Dono único do modo leitura: as páginas de doc (tarefa/vault/docs/skill) leem e escrevem aqui,
// e o footer global do prompt usa `reading` pra se elevar e ficar sutil sobre o overlay de leitura
// (sem ponte página→footer). Efêmero por natureza — não persiste. Cada página reseta no unmount.
interface ReadingModeState {
	reading: boolean;
	setReading: (reading: boolean) => void;
}

export const useReadingModeStore = create<ReadingModeState>((set) => ({
	reading: false,
	setReading: (reading) => set({ reading }),
}));
