import { useEffect } from "react";
import { create } from "zustand";

type ProjectSelectDialogState = {
	open: boolean;
	openDialog: () => void;
	closeDialog: () => void;
};

export const useProjectSelectDialogStore = create<ProjectSelectDialogState>((set) => ({
	open: false,
	openDialog: () => set({ open: true }),
	closeDialog: () => set({ open: false }),
}));

export function useProjectSelectDialog() {
	const open = useProjectSelectDialogStore((s) => s.open);
	const openDialog = useProjectSelectDialogStore((s) => s.openDialog);
	const closeDialog = useProjectSelectDialogStore((s) => s.closeDialog);

	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if (!e.altKey || e.code !== "KeyP") {
				return;
			}

			e.preventDefault();
			openDialog();
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [openDialog]);

	return { open, openDialog, closeDialog };
}
