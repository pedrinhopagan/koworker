import { lstat, readdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import dayjs from "dayjs";

export async function pruneDeploymentBackups() {
	const cutoff = dayjs().subtract(3, "day").valueOf();
	const root = join(homedir(), "Documents", "backups");

	for (const category of ["kowork-hot-deploy", "kowork-sharp-vendor", "kowork-manual-deploy"]) {
		const directory = join(root, category);
		const entries = await readdir(directory, { withFileTypes: true }).catch(
			(error: NodeJS.ErrnoException) => {
				if (error.code === "ENOENT") {
					return [];
				}

				throw error;
			},
		);

		for (const entry of entries) {
			if (!entry.isDirectory()) {
				continue;
			}

			const path = join(directory, entry.name);
			const timestamp = entry.name.replace(/T(\d{2})-(\d{2})-(\d{2})/, "T$1:$2:$3");
			const createdAt = /^\d{4}-\d{2}-\d{2}T/.test(timestamp)
				? dayjs(timestamp).valueOf()
				: (await lstat(path)).mtimeMs;

			if (createdAt < cutoff) {
				await rm(path, { recursive: true, force: true });
			}
		}
	}
}

if (import.meta.main) {
	await pruneDeploymentBackups();
}
