import type { RouterInputs } from "@/client";

export type SkillImportInput = RouterInputs["skills"]["importPreview"];

type FileEntry = {
	isFile: boolean;
	isDirectory: boolean;
	name: string;
	fullPath: string;
	file?: (resolve: (file: File) => void, reject: (error: unknown) => void) => void;
	createReader?: () => {
		readEntries: (
			resolve: (entries: FileEntry[]) => void,
			reject: (error: unknown) => void,
		) => void;
	};
};

async function readEntryFiles(entry: FileEntry): Promise<{ file: File; path: string }[]> {
	if (entry.isFile && entry.file) {
		const read = entry.file;
		const file = await new Promise<File>((resolve, reject) => {
			read(resolve, reject);
		});
		return [{ file, path: entry.fullPath.replace(/^\/+/, "") }];
	}
	if (!entry.isDirectory || !entry.createReader) {
		return [];
	}

	const reader = entry.createReader();
	const children: FileEntry[] = [];
	for (;;) {
		const batch = await new Promise<FileEntry[]>((resolve, reject) => {
			reader.readEntries(resolve, reject);
		});
		if (batch.length === 0) break;
		children.push(...batch);
	}
	const nested = await Promise.all(children.map(readEntryFiles));

	return nested.flat();
}

export function looksLikeSkillText(text: string) {
	const value = text.trim();
	if (!value) return false;
	if (!value.includes("\n")) {
		return /^(file:\/\/|~\/|\/|[A-Za-z]:[\\/])/.test(value.replaceAll(/^["']|["']$/g, ""));
	}

	return value.startsWith("---\n") || value.startsWith("---\r\n") || value.startsWith('===== "');
}

function fromFiles(files: File[], paths?: string[]): SkillImportInput | null {
	if (files.length === 0) return null;

	return {
		kind: "files",
		files,
		paths: paths ?? files.map((file) => file.webkitRelativePath || file.name),
	};
}

export async function importInputFromDataTransfer(
	dataTransfer: DataTransfer,
): Promise<SkillImportInput | null> {
	const entries = [...dataTransfer.items]
		.filter((item) => item.kind === "file")
		.map((item) => item.webkitGetAsEntry?.() as FileEntry | null)
		.filter((entry): entry is FileEntry => !!entry);
	const looseFiles = [...dataTransfer.files];
	const uri = dataTransfer
		.getData("text/uri-list")
		.split(/\r?\n/)
		.find((line) => line.trim() && !line.startsWith("#"));
	const text = uri ?? dataTransfer.getData("text/plain");

	if (entries.some((entry) => entry.isDirectory)) {
		const collected = (await Promise.all(entries.map(readEntryFiles))).flat();
		return fromFiles(
			collected.map((item) => item.file),
			collected.map((item) => item.path),
		);
	}
	if (looseFiles.length > 0) {
		return fromFiles(looseFiles);
	}
	if (text.trim()) {
		return { kind: "text", content: text };
	}

	return null;
}

export function importInputFromFileList(list: FileList | null) {
	return fromFiles([...(list ?? [])]);
}

export function hasImportableDrag(dataTransfer: DataTransfer | null) {
	if (!dataTransfer) return false;

	return [...dataTransfer.types].some(
		(type) => type === "Files" || type === "text/uri-list" || type === "text/plain",
	);
}
