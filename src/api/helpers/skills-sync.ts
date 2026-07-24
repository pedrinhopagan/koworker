import { cp, lstat, mkdir, readlink, readdir, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { readSkillFile } from "@/lib/skills/parser";
import { dbSkillSourcePaths } from "../db/skill-source-paths";
import { SYNCED_SKILL_TOOLS, type SkillTool } from "./skills-fs";
import { expandTilde } from "./os-actions";
import { inspectSkillDirectory, replaceSkillDirectories } from "./skill-directory";

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
	const roots = rows
		.filter((row) => row.scope === "global" && SYNCED_SKILL_TOOLS.has(row.tool as SkillTool))
		.map((row) => ({ tool: row.tool as SkillTool, path: expandTilde(row.path) }));
	const deduplicated: SyncRoot[] = [];
	for (const root of roots) {
		const identity = await realpath(root.path).catch((err: any) => {
			if (err?.code === "ENOENT") {
				return resolve(root.path);
			}
			throw err;
		});
		if (!seen.has(identity)) {
			seen.add(identity);
			deduplicated.push(root);
		}
	}

	return deduplicated;
}

async function directoryFingerprint(path: string) {
	const manifest = await inspectSkillDirectory(path);
	return {
		hash: manifest.hash,
		contentHash: manifest.contentHash,
		files: manifest.files.length,
		entryType: manifest.entryType,
		...(manifest.linkTarget ? { linkTarget: manifest.linkTarget } : {}),
		fileNames: manifest.files.map((file) => file.path),
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
					const fingerprint = await directoryFingerprint(source.path);
					const file = await readSkillFile(join(source.path, "SKILL.md"));

					return {
						tool: source.root.tool,
						path: source.path,
						...fingerprint,
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

	await replaceSkillDirectories(
		jobs.map((job) => ({
			sourceDir: job.chosen.path,
			targetDir: job.targetPath,
			expectedContentHash: job.chosen.contentHash,
			expectedHash: job.chosen.hash,
			expectedTargetContentHash: job.existing?.contentHash ?? null,
			expectedTargetHash: job.existing?.hash ?? null,
		})),
	).catch((err: any) => {
		throw new Error(`Sincronização interrompida: ${err.message}. Backup em ${backupPath}`, {
			cause: err,
		});
	});
	const created = jobs.filter((job) => !job.existing).length;
	const updated = jobs.length - created;

	return { backupPath, created, updated };
}
