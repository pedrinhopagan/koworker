import { create } from "zustand";

type DraggedTask = {
	id: string;
	title: string;
	fromDate: string | null;
};

type AgendaStore = {
	draggedTask: DraggedTask | null;
	drawerCollapsed: boolean;
	selectedDate: string | null;
	setDraggedTask: (task: DraggedTask | null) => void;
	setDrawerCollapsed: (collapsed: boolean) => void;
	setSelectedDate: (date: string | null) => void;
	openDrawer: (date: string) => void;
	closeDrawer: () => void;
};

export const useAgendaStore = create<AgendaStore>((set) => ({
	draggedTask: null,
	drawerCollapsed: false,
	selectedDate: null,
	setDraggedTask: (task) => set({ draggedTask: task }),
	setDrawerCollapsed: (collapsed) => set({ drawerCollapsed: collapsed }),
	setSelectedDate: (date) => set({ selectedDate: date }),
	openDrawer: (date) => set({ selectedDate: date, drawerCollapsed: false }),
	closeDrawer: () => set({ selectedDate: null, drawerCollapsed: true }),
}));
