import { cp, lstat, mkdir, readlink, readdir, realpath, rename, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { readSkillFile } from "@/lib/skills/parser";
import { dbSkillSourcePaths } from "../db/skill-source-paths";
import { skillContentHash, SYNCED_SKILL_TOOLS, type SkillTool } from "./skills-fs";
import { expandTilde } from "./os-actions";

const home = homedir();
const backupRoot = join(home, "backups", "koworker", "skills");

type SyncRoot = {
	tool: SkillTool;
	path: string;
};

export type SkillSyncSource = {
	tool: SkillTool;
	path: string;
	hash: string;
	contentHash: string;
	files: number;
	entryType: "directory" | "symlink";
	linkTarget?: string;
	fileNames: string[];
	preview: string;
	updatedAt: number;
};

export type SkillSyncItem = {
	slug: string;
	conflict: boolean;
	sources: SkillSyncSource[];
	missingTools: SkillTool[];
};

export type SkillSyncPlan = {
	planHash: string;
	backupRoot: string;
	skills: SkillSyncItem[];
	totals: {
		skills: number;
		conflicts: number;
		toCreate: number;
		toUpdate: number;
	};
};

async function globalRoots() {
	const rows = await dbSkillSourcePaths.list();
	const seen = new Set<string>();

	return rows
		.filter((row) => row.scope === "global" && SYNCED_SKILL_TOOLS.has(row.tool as SkillTool))
		.map((row) => ({ tool: row.tool as SkillTool, path: expandTilde(row.path) }))
		.filter((root) => {
			const path = resolve(root.path);
			if (seen.has(path)) {
				return false;
			}
			seen.add(path);
			return true;
		});
}

async function directoryFingerprint(path: string) {
	const entries: string[] = [];
	const contentEntries: string[] = [];
	const fileNames: string[] = [];
	let files = 0;
	const rootStat = await lstat(path);
	const entryType: SkillSyncSource["entryType"] = rootStat.isSymbolicLink()
		? "symlink"
		: "directory";
	const linkTarget = rootStat.isSymbolicLink() ? await readlink(path) : undefined;
	const contentRoot = rootStat.isSymbolicLink() ? await realpath(path) : path;

	async function visit(currentPath: string, relativePath: string) {
		const currentStat = await lstat(currentPath);
		const mode = currentStat.mode & 0o777;

		if (currentStat.isSymbolicLink()) {
			throw new Error(`Link interno não suportado em ${currentPath}`);
		}

		if (!currentStat.isDirectory()) {
			const bytes = new Uint8Array(await Bun.file(currentPath).arrayBuffer());
			entries.push(`f:${relativePath}:${mode}:${Bun.hash(bytes).toString()}`);
			fileNames.push(relativePath);
			files++;

			if (relativePath === "SKILL.md") {
				const file = await readSkillFile(currentPath);
				contentEntries.push(
					file
						? `skill:${skillContentHash(file)}`
						: `f:${relativePath}:${Bun.hash(bytes).toString()}`,
				);
				return;
			}
			contentEntries.push(`f:${relativePath}:${Bun.hash(bytes).toString()}`);
			return;
		}

		entries.push(`d:${relativePath}:${mode}`);
		const children = await readdir(currentPath);
		children.sort((a, b) => a.localeCompare(b));

		for (const child of children) {
			await visit(join(currentPath, child), join(relativePath, child));
		}
	}

	await visit(contentRoot, ".");

	return {
		hash: Bun.hash(entries.join("\n")).toString(),
		contentHash: Bun.hash(contentEntries.join("\n")).toString(),
		files,
		entryType,
		linkTarget,
		fileNames,
	};
}

function pickDefaultSource(sources: SkillSyncSource[]) {
	return (
		sources.find((source) => source.tool === "agents") ??
		sources.reduce((latest, source) => (source.updatedAt > latest.updatedAt ? source : latest))
	);
}

async function slugsForRoot(root: SyncRoot) {
	const entries = await readdir(root.path, { withFileTypes: true }).catch(() => []);
	const slugs = await Promise.all(
		entries
			.filter((entry) => !entry.name.startsWith("."))
			.filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
			.map(async (entry) => {
				const path = join(root.path, entry.name);
				return (await Bun.file(join(path, "SKILL.md")).exists())
					? { slug: entry.name, path }
					: null;
			}),
	);

	return slugs.filter((entry): entry is { slug: string; path: string } => entry !== null);
}

function fingerprintPlan(data: Omit<SkillSyncPlan, "planHash">) {
	return Bun.hash(
		JSON.stringify({
			skills: data.skills.map((skill) => ({
				slug: skill.slug,
				missingTools: skill.missingTools,
				sources: skill.sources.map((source) => ({
					tool: source.tool,
					path: resolve(source.path),
					hash: source.hash,
					contentHash: source.contentHash,
					entryType: source.entryType,
					linkTarget: source.linkTarget,
				})),
			})),
		}),
	).toString();
}

export async function previewSkillSyncInFs(): Promise<SkillSyncPlan> {
	const roots = await globalRoots();
	if (roots.length < 2) {
		throw new Error("Cadastre as pastas globais de skills de pelo menos duas CLIs");
	}

	const sourcesBySlug = new Map<string, { root: SyncRoot; path: string }[]>();
	for (const root of roots) {
		for (const source of await slugsForRoot(root)) {
			const current = sourcesBySlug.get(source.slug) ?? [];
			current.push({ root, path: source.path });
			sourcesBySlug.set(source.slug, current);
		}
	}

	const skills = await Promise.all(
		[...sourcesBySlug.entries()].map(async ([slug, sources]) => {
			const detailed = await Promise.all(
				sources.map(async (source) => {
					const file = await readSkillFile(join(source.path, "SKILL.md"));

					return {
						tool: source.root.tool,
						path: source.path,
						...(await directoryFingerprint(source.path)),
						preview: file?.body.trim().slice(0, 400) ?? "",
						updatedAt: (await stat(join(source.path, "SKILL.md"))).mtimeMs,
					};
				}),
			);
			const presentPaths = new Set(sources.map((source) => resolve(source.path)));

			return {
				slug,
				conflict: new Set(detailed.map((source) => source.contentHash)).size > 1,
				sources: detailed,
				missingTools: [
					...new Set(
						roots
							.filter((root) => !presentPaths.has(resolve(join(root.path, slug))))
							.map((root) => root.tool),
					),
				],
			};
		}),
	);

	skills.sort((a, b) => a.slug.localeCompare(b.slug));
	const data = {
		backupRoot,
		skills,
		totals: {
			skills: skills.length,
			conflicts: skills.filter((skill) => skill.conflict).length,
			toCreate: skills.reduce((total, skill) => total + skill.missingTools.length, 0),
			toUpdate: skills.reduce((total, skill) => {
				const chosen = pickDefaultSource(skill.sources);
				return (
					total + skill.sources.filter((source) => source.contentHash !== chosen.contentHash).length
				);
			}, 0),
		},
	};

	return { planHash: fingerprintPlan(data), ...data };
}

async function backupSources(
	plan: SkillSyncPlan,
	replaced: { slug: string; source: SkillSyncSource }[],
) {
	const backupPath = join(
		backupRoot,
		`${new Date().toISOString().replaceAll(":", "-")}-${crypto.randomUUID().slice(0, 8)}`,
	);
	await mkdir(backupPath, { recursive: true });

	for (const { slug, source } of replaced) {
		const materializedTarget = join(backupPath, source.tool, slug);
		const originalTarget = join(backupPath, "original", source.tool, slug);
		await mkdir(dirname(materializedTarget), { recursive: true });
		await mkdir(dirname(originalTarget), { recursive: true });
		await cp(source.path, materializedTarget, { recursive: true, dereference: true });
		await cp(source.path, originalTarget, {
			recursive: true,
			dereference: false,
			verbatimSymlinks: true,
		});

		const materialized = await directoryFingerprint(materializedTarget);
		const originalStat = await lstat(originalTarget);
		const originalEntryType = originalStat.isSymbolicLink() ? "symlink" : "directory";
		const originalLinkTarget = originalStat.isSymbolicLink()
			? await readlink(originalTarget)
			: undefined;
		const originalHash = originalStat.isSymbolicLink()
			? source.hash
			: (await directoryFingerprint(originalTarget)).hash;
		if (
			materialized.hash !== source.hash ||
			originalHash !== source.hash ||
			originalEntryType !== source.entryType ||
			originalLinkTarget !== source.linkTarget
		) {
			throw new Error(`Falha no backup de ${slug}: verificação não bateu`);
		}
	}

	await Bun.write(
		join(backupPath, "manifest.json"),
		JSON.stringify({ createdAt: new Date().toISOString(), plan, replaced }, null, 2),
	);

	return backupPath;
}

async function replaceTarget(input: {
	slug: string;
	targetPath: string;
	existing: SkillSyncSource;
	chosen: SkillSyncSource;
}) {
	const quarantinePath = join(
		dirname(input.targetPath),
		`.${input.slug}.koworker-sync-${crypto.randomUUID().slice(0, 8)}`,
	);
	await rename(input.targetPath, quarantinePath);

	try {
		const quarantined = await directoryFingerprint(quarantinePath);
		if (quarantined.hash !== input.existing.hash) {
			throw new Error(`${input.slug} mudou durante a sincronização`);
		}

		await cp(input.chosen.path, input.targetPath, { recursive: true, dereference: true });
		const installed = await directoryFingerprint(input.targetPath);
		if (installed.hash !== input.chosen.hash) {
			throw new Error(`Falha ao instalar ${input.slug}: verificação não bateu`);
		}
	} catch (err: any) {
		await rm(input.targetPath, { recursive: true, force: true });
		await rename(quarantinePath, input.targetPath);
		throw err;
	}

	await rm(quarantinePath, { recursive: true, force: true });
}

async function createTarget(input: { slug: string; root: SyncRoot; chosen: SkillSyncSource }) {
	const targetPath = join(input.root.path, input.slug);
	await mkdir(input.root.path, { recursive: true });
	await cp(input.chosen.path, targetPath, { recursive: true, dereference: true });

	const installed = await directoryFingerprint(targetPath);
	if (installed.hash !== input.chosen.hash) {
		await rm(targetPath, { recursive: true, force: true });
		throw new Error(`Falha ao instalar ${input.slug}: verificação não bateu`);
	}
}

export async function applySkillSyncInFs(input: {
	planHash: string;
	choices: { slug: string; sourcePath: string; hash: string }[];
}) {
	const plan = await previewSkillSyncInFs();
	if (plan.planHash !== input.planHash) {
		throw new Error("As skills mudaram desde a análise. Revise os conflitos novamente");
	}

	const roots = await globalRoots();
	const choices = new Map(input.choices.map((choice) => [choice.slug, choice]));
	const selected = plan.skills.map((skill) => {
		const choice = choices.get(skill.slug);
		if (skill.conflict && !choice) {
			throw new Error(`Escolha qual versão manter para ${skill.slug}`);
		}

		const chosen = choice
			? skill.sources.find(
					(candidate) => candidate.path === choice.sourcePath && candidate.hash === choice.hash,
				)
			: pickDefaultSource(skill.sources);
		if (!chosen) {
			throw new Error(`A versão escolhida para ${skill.slug} não está mais disponível`);
		}

		return { skill, chosen };
	});

	const jobs = selected.flatMap(({ skill, chosen }) =>
		roots.flatMap((root) => {
			const targetPath = join(root.path, skill.slug);
			const existing = skill.sources.find((source) => resolve(source.path) === resolve(targetPath));
			if (existing && existing.contentHash === chosen.contentHash) {
				return [];
			}

			return [{ slug: skill.slug, root, targetPath, existing, chosen }];
		}),
	);

	if (jobs.length === 0) {
		return { backupPath: null, created: 0, updated: 0 };
	}

	const backupPath = await backupSources(
		plan,
		jobs.flatMap((job) => (job.existing ? [{ slug: job.slug, source: job.existing }] : [])),
	);

	let created = 0;
	let updated = 0;
	for (const job of jobs) {
		try {
			if (job.existing) {
				await replaceTarget({
					slug: job.slug,
					targetPath: job.targetPath,
					existing: job.existing,
					chosen: job.chosen,
				});
				updated++;
			} else {
				await createTarget({ slug: job.slug, root: job.root, chosen: job.chosen });
				created++;
			}
		} catch (err: any) {
			throw new Error(
				`Sincronização interrompida em ${job.slug}: ${err.message}. Backup em ${backupPath}`,
				{ cause: err },
			);
		}
	}

	return { backupPath, created, updated };
}
