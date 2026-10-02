import {
	cp,
	lstat,
	mkdir,
	open,
	readlink,
	readdir,
	realpath,
	rename,
	rm,
	stat,
	symlink,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { readSkillFile } from "@/lib/skills/parser";
import { dbSkillSourcePaths } from "../db/skill-source-paths";
import { invalidateSkillsFsCache, SYNCED_SKILL_TOOLS, type SkillTool } from "./skills-fs";
import { expandTilde } from "./os-actions";
import { inspectSkillDirectory } from "./skill-directory";

const home = homedir();
const backupRoot = join(home, "backups", "koworker", "skills");

export type SyncRoot = {
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
	canonicalRoot: string;
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
	centralRoot: string;
	roots: SyncRoot[];
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
		.map((row) => ({
			tool: row.tool as SkillTool,
			path: expandTilde(row.path),
		}))
		.sort((left, right) => Number(right.tool === "agents") - Number(left.tool === "agents"));
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

	for (const [index, root] of deduplicated.entries()) {
		for (const other of deduplicated.slice(index + 1)) {
			for (const [parent, child] of [
				[root.path, other.path],
				[other.path, root.path],
			]) {
				const path = relative(parent, child);
				if (path && !path.startsWith("..") && !isAbsolute(path)) {
					throw new Error("As pastas globais de skills não podem ficar uma dentro da outra");
				}
			}
		}
	}
	if (deduplicated.filter((root) => root.tool === "agents").length > 1) {
		throw new Error("Mantenha uma única pasta global Agents como biblioteca central");
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
		canonicalRoot: manifest.canonicalRoot,
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
			centralRoot: data.centralRoot,
			roots: data.roots,
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

export async function previewSkillSyncInFs(slug?: string): Promise<SkillSyncPlan> {
	const roots = await globalRoots();
	const central = roots.find((root) => root.tool === "agents");
	if (!central) {
		throw new Error("Cadastre a pasta global Agents para centralizar as skills");
	}

	const sourcesBySlug = new Map<string, { root: SyncRoot; path: string }[]>();
	for (const root of roots) {
		for (const source of await slugsForRoot(root)) {
			if (slug && source.slug !== slug) {
				continue;
			}
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
							.filter(
								(root) =>
									(root.tool === "agents" || root.tool === "claude-code") &&
									!presentPaths.has(resolve(join(root.path, slug))),
							)
							.map((root) => root.tool),
					),
				],
			};
		}),
	);

	skills.sort((a, b) => a.slug.localeCompare(b.slug));
	const data = {
		backupRoot,
		centralRoot: central.path,
		roots,
		skills,
		totals: {
			skills: skills.length,
			conflicts: skills.filter((skill) => skill.conflict).length,
			toCreate: skills.reduce((total, skill) => total + skill.missingTools.length, 0),
			toUpdate: skills.reduce((total, skill) => {
				const chosen = pickDefaultSource(skill.sources);
				return (
					total +
					skill.sources.filter((source) => {
						if (source.tool === "agents") {
							return source.entryType !== "directory" || source.contentHash !== chosen.contentHash;
						}
						return (
							source.tool !== "claude-code" ||
							source.entryType !== "symlink" ||
							source.canonicalRoot !== resolve(join(central.path, skill.slug))
						);
					}).length
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
		await cp(source.path, materializedTarget, {
			recursive: true,
			dereference: true,
		});
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
	slug?: string;
}) {
	await mkdir(backupRoot, { recursive: true });
	const lockPath = join(backupRoot, ".sync.lock");
	const lock = await open(lockPath, "wx").catch((err: NodeJS.ErrnoException) => {
		if (err.code !== "EEXIST") {
			throw err;
		}
		throw new Error("Outra centralização está em andamento. Confira o lock de skills", {
			cause: err,
		});
	});
	try {
		await lock.writeFile(JSON.stringify({ pid: process.pid, createdAt: Date.now() }));
		return await applyLockedSkillSync(input);
	} finally {
		await lock.close();
		await rm(lockPath);
		invalidateSkillsFsCache();
	}
}

async function applyLockedSkillSync(input: {
	planHash: string;
	choices: { slug: string; sourcePath: string; hash: string }[];
	slug?: string;
}) {
	const plan = await previewSkillSyncInFs(input.slug);
	if (plan.planHash !== input.planHash) {
		throw new Error("As skills mudaram desde a análise. Revise os conflitos novamente");
	}
	const roots = await globalRoots();
	const choices = new Map(input.choices.map((choice) => [choice.slug, choice]));
	const jobs = plan.skills.flatMap((skill) => {
		const choice = choices.get(skill.slug);
		if (skill.conflict && !choice) {
			throw new Error(`Escolha qual versão manter para ${skill.slug}`);
		}
		const chosen = choice
			? skill.sources.find(
					(source) => source.path === choice.sourcePath && source.hash === choice.hash,
				)
			: pickDefaultSource(skill.sources);
		if (!chosen) {
			throw new Error(`A versão escolhida para ${skill.slug} não está mais disponível`);
		}
		const centralPath = join(plan.centralRoot, skill.slug);
		return roots.flatMap((root) => {
			const targetPath = join(root.path, skill.slug);
			const existing = skill.sources.find((source) => resolve(source.path) === resolve(targetPath));
			const mode = (
				{
					agents: "copy",
					"claude-code": "link",
					codex: "remove",
					opencode: "remove",
					koworker: "remove",
				} as const
			)[root.tool];
			if (mode === "remove" && !existing) {
				return [];
			}
			if (
				mode === "copy" &&
				existing?.entryType === "directory" &&
				existing.contentHash === chosen.contentHash
			) {
				return [];
			}
			if (
				mode === "link" &&
				existing?.entryType === "symlink" &&
				existing.canonicalRoot === resolve(centralPath)
			) {
				return [];
			}
			return [{ slug: skill.slug, mode, targetPath, centralPath, existing, chosen }];
		});
	});
	if (jobs.length === 0) {
		return { backupPath: null, created: 0, updated: 0 };
	}
	const backupPath = await backupSources(
		plan,
		jobs.flatMap((job) => (job.existing ? [{ slug: job.slug, source: job.existing }] : [])),
	);
	const prepared: {
		job: (typeof jobs)[number];
		temporary: string;
		quarantine: string;
		moved: boolean;
		installed: boolean;
	}[] = [];
	try {
		for (const job of jobs) {
			await mkdir(dirname(job.targetPath), { recursive: true });
			const temporary = join(dirname(job.targetPath), `.${crypto.randomUUID()}.koworker-preparado`);
			const quarantine = join(
				dirname(job.targetPath),
				`.${crypto.randomUUID()}.koworker-quarentena`,
			);
			prepared.push({
				job,
				temporary,
				quarantine,
				moved: false,
				installed: false,
			});
			if (job.mode === "copy") {
				await cp(job.chosen.path, temporary, {
					recursive: true,
					dereference: true,
				});
				if ((await directoryFingerprint(temporary)).hash !== job.chosen.hash) {
					throw new Error(`A origem ${job.chosen.path} mudou durante a preparação`);
				}
			}
			if (job.mode === "link") {
				await symlink(resolve(job.centralPath), temporary, "junction");
			}
		}
		const current = await previewSkillSyncInFs(input.slug);
		if (current.planHash !== plan.planHash) {
			throw new Error("As skills mudaram durante o backup");
		}
		for (const item of prepared) {
			if (item.job.existing) {
				await rename(item.job.targetPath, item.quarantine);
				item.moved = true;
			}
		}
		for (const item of prepared) {
			if (item.job.mode !== "remove") {
				await rename(item.temporary, item.job.targetPath);
				item.installed = true;
			}
		}
		for (const item of prepared) {
			if (
				item.job.mode !== "remove" &&
				(await directoryFingerprint(item.job.targetPath)).contentHash !==
					item.job.chosen.contentHash
			) {
				throw new Error(`Falha ao verificar ${item.job.targetPath}`);
			}
		}
	} catch (err) {
		const failures: unknown[] = [];
		for (const item of prepared.toReversed()) {
			try {
				if (item.installed) {
					await rm(item.job.targetPath, { recursive: true, force: true });
				}
				if (item.moved) {
					await rename(item.quarantine, item.job.targetPath);
				}
			} catch (failure) {
				failures.push(failure);
			}
		}
		const failure = new AggregateError(
			[err, ...failures],
			`Centralização interrompida: ${err instanceof Error ? err.message : err}. Backup em ${backupPath}`,
		);
		Object.assign(failure, { cause: err });
		throw failure;
	} finally {
		await Promise.all(prepared.map((item) => rm(item.temporary, { recursive: true, force: true })));
	}
	await Promise.all(prepared.map((item) => rm(item.quarantine, { recursive: true, force: true })));
	return {
		backupPath,
		created: jobs.filter((job) => !job.existing).length,
		updated: jobs.filter((job) => !!job.existing).length,
	};
}
