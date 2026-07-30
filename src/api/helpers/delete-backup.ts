import { mkdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export const DELETE_BACKUP_ROOT = join(homedir(), "Documentos", "backups", "koworker");
export const SKILL_DELETE_BACKUP_ROOT = join(DELETE_BACKUP_ROOT, "skills");
export const AGENT_DELETE_BACKUP_ROOT = join(DELETE_BACKUP_ROOT, "agents");

export type DeleteBackupSource = {
	tool: string;
	scope: string;
	path: string;
};

export async function createDeleteBackup<TSource extends DeleteBackupSource>(input: {
	root: string;
	slug: string;
	settings: unknown;
	sources: TSource[];
	copySource: (source: TSource, target: string) => Promise<Record<string, unknown>>;
}): Promise<string> {
	const backupPath = join(
		input.root,
		`${new Date().toISOString().replaceAll(":", "-")}-${input.slug}-${crypto.randomUUID().slice(0, 8)}`,
	);

	await mkdir(backupPath, { recursive: true });

	try {
		const sources: Record<string, unknown>[] = [];
		for (const [index, source] of input.sources.entries()) {
			const target = join(
				backupPath,
				"sources",
				`${String(index + 1).padStart(3, "0")}-${source.tool}-${source.scope}`,
			);
			const details = await input.copySource(source, target);
			sources.push({ tool: source.tool, scope: source.scope, path: source.path, ...details });
		}

		await Bun.write(
			join(backupPath, "manifest.json"),
			JSON.stringify(
				{
					createdAt: new Date().toISOString(),
					slug: input.slug,
					settings: input.settings,
					sources,
				},
				null,
				2,
			),
		);
	} catch (err) {
		await rm(backupPath, { recursive: true, force: true });
		throw err;
	}

	return backupPath;
}
