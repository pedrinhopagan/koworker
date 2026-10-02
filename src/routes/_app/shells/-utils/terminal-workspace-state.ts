import type {
	TerminalWorkspaceEntry,
	TerminalWorkspaceSnapshot,
} from "@/api/schemas/terminal-workspace";

function sameCapabilities(left: TerminalWorkspaceEntry, right: TerminalWorkspaceEntry) {
	return (Object.keys(left.capabilities) as (keyof TerminalWorkspaceEntry["capabilities"])[]).every(
		(key) => left.capabilities[key] === right.capabilities[key],
	);
}

function sameEntry(left: TerminalWorkspaceEntry, right: TerminalWorkspaceEntry) {
	return (
		left.kind === right.kind &&
		left.key === right.key &&
		left.label === right.label &&
		left.groupLabel === right.groupLabel &&
		left.cwd === right.cwd &&
		left.projectId === right.projectId &&
		left.projectName === right.projectName &&
		left.agent === right.agent &&
		left.taskId === right.taskId &&
		left.taskTitle === right.taskTitle &&
		left.status === right.status &&
		left.title === right.title &&
		left.activity === right.activity &&
		left.changedAt === right.changedAt &&
		left.exitCode === right.exitCode &&
		sameCapabilities(left, right)
	);
}

export function reconcileTerminalWorkspaceSnapshot(
	current: TerminalWorkspaceSnapshot | null,
	incoming: TerminalWorkspaceSnapshot,
) {
	if (!current) {
		return incoming;
	}

	const currentByKey = new Map(current.entries.map((entry) => [entry.key, entry]));
	const entries = incoming.entries.map((entry) => {
		const previous = currentByKey.get(entry.key);

		return previous && sameEntry(previous, entry) ? previous : entry;
	});

	return { ...incoming, entries };
}

export function resolveTerminalWorkspaceSelection(
	entries: TerminalWorkspaceEntry[],
	selectedKey?: string,
) {
	if (!selectedKey || entries.some((entry) => entry.key === selectedKey)) {
		return selectedKey ?? null;
	}

	return entries[0]?.key ?? null;
}
