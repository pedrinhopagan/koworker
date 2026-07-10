import type { PromptImage } from "@/stores/prompt-bar";

export interface PromptSnapshot {
	text: string;
	caret: number;
	images: PromptImage[];
}

type EditKind = "insert" | "delete" | "other";

const MAX_SNAPSHOTS = 100;

function isWhitespace(char: string) {
	return /\s/.test(char);
}

function classifyEdit(prev: string, next: string): { kind: EditKind; char: string | null } {
	let start = 0;
	const minLength = Math.min(prev.length, next.length);
	while (start < minLength && prev[start] === next[start]) {
		start++;
	}

	let prevEnd = prev.length;
	let nextEnd = next.length;
	while (prevEnd > start && nextEnd > start && prev[prevEnd - 1] === next[nextEnd - 1]) {
		prevEnd--;
		nextEnd--;
	}

	const deleted = prev.slice(start, prevEnd);
	const inserted = next.slice(start, nextEnd);

	if (inserted.length === 1 && deleted.length === 0) {
		return { kind: "insert", char: inserted };
	}
	if (deleted.length === 1 && inserted.length === 0) {
		return { kind: "delete", char: deleted };
	}
	return { kind: "other", char: null };
}

export class PromptUndoHistory {
	private undoStack: PromptSnapshot[] = [];
	private redoStack: PromptSnapshot[] = [];
	private lastKind: EditKind | null = null;
	private lastChar: string | null = null;

	record(prev: PromptSnapshot, next: string) {
		if (prev.text === next) {
			return;
		}

		const { kind, char } = classifyEdit(prev.text, next);
		const startsWord =
			kind === "insert" &&
			char !== null &&
			!isWhitespace(char) &&
			this.lastChar !== null &&
			isWhitespace(this.lastChar);
		const leavesWord =
			kind === "delete" &&
			char !== null &&
			isWhitespace(char) &&
			this.lastChar !== null &&
			!isWhitespace(this.lastChar);

		if (kind === "other" || kind !== this.lastKind || startsWord || leavesWord) {
			this.undoStack.push(prev);
			if (this.undoStack.length > MAX_SNAPSHOTS) {
				this.undoStack.shift();
			}
		}

		this.redoStack = [];
		this.lastKind = kind === "other" ? null : kind;
		this.lastChar = char;
	}

	undo(current: PromptSnapshot) {
		const snapshot = this.undoStack.pop();
		if (!snapshot) {
			return null;
		}

		this.redoStack.push(current);
		this.lastKind = null;
		this.lastChar = null;
		return snapshot;
	}

	redo(current: PromptSnapshot) {
		const snapshot = this.redoStack.pop();
		if (!snapshot) {
			return null;
		}

		this.undoStack.push(current);
		this.lastKind = null;
		this.lastChar = null;
		return snapshot;
	}
}
