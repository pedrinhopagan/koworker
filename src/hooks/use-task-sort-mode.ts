import { useCallback, useSyncExternalStore } from "react";

import { TASK_SORT_MODES, type TaskSortMode } from "@/constants/tasks";

const TASK_SORT_MODE_KEY = "tarefas:sortMode";

function isTaskSortMode(value: string | null): value is TaskSortMode {
	return TASK_SORT_MODES.some(({ mode }) => mode === value);
}

export function useTaskSortMode(): [TaskSortMode, (mode: TaskSortMode) => void] {
	const subscribe = useCallback((onChange: () => void) => {
		window.addEventListener("storage", onChange);
		return () => window.removeEventListener("storage", onChange);
	}, []);
	const stored = useSyncExternalStore(
		subscribe,
		() => localStorage.getItem(TASK_SORT_MODE_KEY),
		() => null,
	);
	const mode = isTaskSortMode(stored) ? stored : "recente";

	const setMode = useCallback((next: TaskSortMode) => {
		localStorage.setItem(TASK_SORT_MODE_KEY, next);
		window.dispatchEvent(new StorageEvent("storage", { key: TASK_SORT_MODE_KEY }));
	}, []);

	return [mode, setMode];
}
