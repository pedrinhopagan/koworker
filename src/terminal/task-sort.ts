export function sortTasksByTerminal<T extends { id: string }>(
	tasks: T[],
	openTaskIds: string[],
): T[] {
	if (openTaskIds.length === 0) return tasks;
	const openSet = new Set(openTaskIds);
	return tasks
		.map((task, index) => ({ task, index, open: openSet.has(task.id) }))
		.sort((a, b) => {
			if (a.open === b.open) return a.index - b.index;
			return a.open ? -1 : 1;
		})
		.map((item) => item.task);
}
