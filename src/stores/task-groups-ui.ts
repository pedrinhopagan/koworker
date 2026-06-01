import { create } from "zustand";
import { persist } from "zustand/middleware";

// Preferências de UI da lista de tarefas agrupada. Persistido pra sobreviver à navegação e ao
// fechamento do app — nada disso vive no banco (são escolhas de visualização, não dados da tarefa).
interface TaskGroupsUiState {
	// Chaves de grupo colapsadas (`groupId` ou o sentinela NO_GROUP). Global, igual ao sortMode: o
	// usuário não pediu por-projeto e ids de grupo reais já são únicos entre projetos.
	collapsedKeys: string[];
	// Posição do bloco virtual "Sem grupo" entre os grupos reais. Default 0 = topo. O grupo não
	// existe no banco, então a ordem dele é preferência de UI em vez de display_order.
	noGroupOrder: number;
	toggleCollapsed: (key: string) => void;
	setCollapsed: (keys: string[]) => void;
	setNoGroupOrder: (index: number) => void;
}

export const useTaskGroupsUiStore = create<TaskGroupsUiState>()(
	persist(
		(set) => ({
			collapsedKeys: [],
			noGroupOrder: 0,
			toggleCollapsed: (key) =>
				set((state) => ({
					collapsedKeys: state.collapsedKeys.includes(key)
						? state.collapsedKeys.filter((k) => k !== key)
						: [...state.collapsedKeys, key],
				})),
			setCollapsed: (keys) => set({ collapsedKeys: keys }),
			setNoGroupOrder: (index) => set({ noGroupOrder: index }),
		}),
		{ name: "kowork-task-groups-ui" },
	),
);
