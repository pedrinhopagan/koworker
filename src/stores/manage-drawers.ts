import { create } from "zustand";

export type ManageDrawerKey = "priorities" | "categories";

type ManageDrawerStore = {
	openByKey: Partial<Record<ManageDrawerKey, boolean>>;
	open: (key: ManageDrawerKey) => void;
	close: (key: ManageDrawerKey) => void;
	setOpen: (key: ManageDrawerKey, open: boolean) => void;
	closeAll: () => void;
};

export const useManageDrawerStore = create<ManageDrawerStore>((set) => ({
	openByKey: {},
	open: (key) => set((s) => ({ openByKey: { ...s.openByKey, [key]: true } })),
	close: (key) => set((s) => ({ openByKey: { ...s.openByKey, [key]: false } })),
	setOpen: (key, open) => set((s) => ({ openByKey: { ...s.openByKey, [key]: open } })),
	closeAll: () => set({ openByKey: {} }),
}));
