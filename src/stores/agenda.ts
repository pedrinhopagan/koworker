import { create } from "zustand";

import type { AgendaEvent } from "@/types/agenda";

export type AgendaView = "semana" | "mes";

// Item em voo no DnD: uma task do backlog (vira event ao soltar) ou um event já existente (move).
export type AgendaDragItem = { kind: "task"; id: string } | { kind: "event"; id: string };

type AgendaStore = {
	view: AgendaView;
	setView: (view: AgendaView) => void;

	// Drawer de criar/editar evento. drawerEvent presente = edição; senão criação em drawerDate.
	drawerOpen: boolean;
	drawerDate?: string;
	drawerEvent?: AgendaEvent;
	openCreate: (date: string) => void;
	openEdit: (event: AgendaEvent) => void;
	closeDrawer: () => void;

	draggedItem?: AgendaDragItem;
	setDraggedItem: (item?: AgendaDragItem) => void;
};

export const useAgendaStore = create<AgendaStore>((set) => ({
	view: "semana",
	setView: (view) => set({ view }),

	drawerOpen: false,
	drawerDate: undefined,
	drawerEvent: undefined,
	openCreate: (date) => set({ drawerOpen: true, drawerDate: date, drawerEvent: undefined }),
	openEdit: (event) => set({ drawerOpen: true, drawerEvent: event, drawerDate: undefined }),
	closeDrawer: () => set({ drawerOpen: false, drawerDate: undefined, drawerEvent: undefined }),

	draggedItem: undefined,
	setDraggedItem: (item) => set({ draggedItem: item }),
}));
