import { create } from "zustand";

export type NavActionDialog = "newVaultNote" | "newTask" | "sweepInvocations";

type NavActionDialogsState = {
	openDialog: NavActionDialog | null;
	open: (dialog: NavActionDialog) => void;
	close: () => void;
};

/**
 * Estado global dos diálogos de ação da navegação. Vive fora da árvore da sidebar/drawer para que
 * abrir um diálogo a partir do drawer mobile (que desmonta ao fechar o Sheet) não descarte o diálogo
 * junto. Os diálogos são montados uma única vez no AppShell.
 */
export const useNavActionDialogsStore = create<NavActionDialogsState>((set) => ({
	openDialog: null,
	open: (dialog) => set({ openDialog: dialog }),
	close: () => set({ openDialog: null }),
}));
