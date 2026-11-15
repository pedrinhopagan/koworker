import { lstat, readdir } from "node:fs/promises";
import { basename, join } from "node:path";

export const BACKUP_MAX_FILE_BYTES = 5 * 1024 * 1024;

const BACKUP_EXCLUDED_DIRECTORIES = new Set([".backups", ".staging", ".git", "node_modules"]);

const BACKUP_EXCLUDED_EXTENSIONS = [
	"png",
	"jpg",
	"jpeg",
	"webp",
	"gif",
	"svg",
	"avif",
	"heic",
	"ico",
	"bmp",
	"tif",
	"tiff",
	"mp4",
	"webm",
	"mov",
	"mkv",
	"avi",
	"wav",
	"mp3",
	"ogg",
	"flac",
	"m4a",
	"zip",
	"gz",
	"zst",
	"tar",
	"7z",
	"rar",
	"dump",
	"bak",
	"sqlite",
];

export async function backupExclusionArgs(paths: string[]) {
	const args = [
		"--exclude-caches",
		...[...BACKUP_EXCLUDED_DIRECTORIES].flatMap((name) => ["--exclude", name]),
		...BACKUP_EXCLUDED_EXTENSIONS.flatMap((extension) => ["--iexclude", `*.${extension}`]),
	];

	async function visit(path: string): Promise<void> {
		if (BACKUP_EXCLUDED_DIRECTORIES.has(basename(path))) {
			return;
		}

		const stats = await lstat(path);

		if (stats.isDirectory()) {
			for (const entry of await readdir(path)) {
				await visit(join(path, entry));
			}
			return;
		}

		if (stats.isFile() && stats.size > BACKUP_MAX_FILE_BYTES) {
			args.push("--exclude", path.replaceAll(/([\\*?[\]])/g, "\\$1"));
		}
	}

	for (const path of paths) {
		await visit(path);
	}

	return args;
}
