import {
	cp,
	lstat,
	mkdir,
	readFile,
	readlink,
	readdir,
	realpath,
	rename,
	rm,
} from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";

export const SKILL_TEXT_FILE_LIMIT = 1024 * 1024;
export const SKILL_TEXT_BUNDLE_LIMIT = 5 * 1024 * 1024;

export type SkillDirectoryFile = {
	path: string;
	size: number;
	kind: "text" | "binary";
	hash: string;
};

export type SkillDirectoryManifest = {
	hash: string;
	contentHash: string;
	files: SkillDirectoryFile[];
	entryType: "directory" | "symlink";
	linkTarget?: string;
	canonicalRoot: string;
};

function isContained(root: string, target: string) {
	const path = relative(root, target);
	return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
}

async function pathExists(path: string) {
	return await lstat(path)
		.then(() => true)
		.catch((err: any) => {
			if (err?.code === "ENOENT" || err?.code === "ENAMETOOLONG") {
				return false;
			}
			throw err;
		});
}

async function canonicalTarget(path: string) {
	if (await pathExists(path)) {
		return await realpath(path);
	}

	const suffix: string[] = [];
	let ancestor = path;
	while (!(await pathExists(ancestor))) {
		suffix.unshift(basename(ancestor));
		const parent = dirname(ancestor);
		if (parent === ancestor) {
			throw new Error(`Não foi possível resolver o destino ${path}`);
		}
		ancestor = parent;
	}

	return join(await realpath(ancestor), ...suffix);
}

export function validateSkillRelativePath(path: string) {
	if (
		!path ||
		isAbsolute(path) ||
		path.includes("\0") ||
		path.includes("\\") ||
		path.split("/").some((segment) => segment === "." || segment === ".." || !segment)
	) {
		throw new Error("Caminho relativo de arquivo inválido");
	}

	return path;
}

function fileKind(bytes: Uint8Array): SkillDirectoryFile["kind"] {
	if (bytes.includes(0)) {
		return "binary";
	}

	try {
		new TextDecoder("utf-8", { fatal: true }).decode(bytes);
		return "text";
	} catch {
		return "binary";
	}
}

export async function inspectSkillDirectory(path: string): Promise<SkillDirectoryManifest> {
	const rootStat = await lstat(path);
	const entryType = rootStat.isSymbolicLink() ? "symlink" : "directory";
	if (entryType === "directory" && !rootStat.isDirectory()) {
		throw new Error(`Pasta de skill inválida: ${path}`);
	}

	const linkTarget = entryType === "symlink" ? await readlink(path) : undefined;
	const canonicalRoot = await realpath(path);
	const canonicalStat = await lstat(canonicalRoot);
	if (!canonicalStat.isDirectory()) {
		throw new Error(`Pasta de skill inválida: ${path}`);
	}

	const physicalEntries: {
		kind: "directory" | "file";
		path: string;
		mode: number;
		hash?: string;
	}[] = [];
	const files: SkillDirectoryFile[] = [];

	async function visit(currentPath: string, relativePath: string) {
		const currentStat = await lstat(currentPath);
		if (currentStat.isSymbolicLink()) {
			throw new Error(`Link interno não suportado em ${relativePath}`);
		}

		const canonicalPath = await realpath(currentPath);
		if (!isContained(canonicalRoot, canonicalPath)) {
			throw new Error(`Arquivo fora da pasta autorizada: ${relativePath}`);
		}

		const mode = currentStat.mode & 0o777;
		if (currentStat.isDirectory()) {
			physicalEntries.push({ kind: "directory", path: relativePath, mode });
			const children = await readdir(currentPath);
			children.sort();

			for (const child of children) {
				await visit(join(currentPath, child), relativePath ? `${relativePath}/${child}` : child);
			}
			return;
		}

		if (!currentStat.isFile()) {
			throw new Error(`Entrada não suportada em ${relativePath}`);
		}

		const bytes = new Uint8Array(await readFile(currentPath));
		const hash = Bun.hash(bytes).toString();
		files.push({ path: relativePath, size: bytes.length, kind: fileKind(bytes), hash });
		physicalEntries.push({ kind: "file", path: relativePath, mode, hash });
	}

	await visit(canonicalRoot, "");
	files.sort((a, b) => {
		if (a.path === "SKILL.md") {
			return -1;
		}
		if (b.path === "SKILL.md") {
			return 1;
		}
		if (a.path < b.path) {
			return -1;
		}
		if (a.path > b.path) {
			return 1;
		}
		return 0;
	});

	return {
		hash: Bun.hash(JSON.stringify(physicalEntries)).toString(),
		contentHash: Bun.hash(
			JSON.stringify(files.map((file) => ({ path: file.path, hash: file.hash }))),
		).toString(),
		files,
		entryType,
		...(linkTarget ? { linkTarget } : {}),
		canonicalRoot,
	};
}

export async function readSkillDirectoryText(input: {
	dir: string;
	relativePath: string;
	manifest?: SkillDirectoryManifest;
}) {
	const relativePath = validateSkillRelativePath(input.relativePath);
	const manifest = input.manifest ?? (await inspectSkillDirectory(input.dir));
	const file = manifest.files.find((candidate) => candidate.path === relativePath);
	if (!file) {
		throw new Error(`Arquivo não encontrado: ${relativePath}`);
	}
	if (file.kind === "binary") {
		throw new Error(`O arquivo ${relativePath} é binário e não pode ser lido como texto`);
	}
	if (file.size > SKILL_TEXT_FILE_LIMIT) {
		throw new Error(`O arquivo ${relativePath} excede o limite de 1 MiB`);
	}

	const unresolvedTarget = join(manifest.canonicalRoot, ...relativePath.split("/"));
	const targetStat = await lstat(unresolvedTarget);
	if (targetStat.isSymbolicLink() || !targetStat.isFile()) {
		throw new Error(`Entrada não suportada em ${relativePath}`);
	}
	const target = await realpath(unresolvedTarget);
	if (!isContained(manifest.canonicalRoot, target)) {
		throw new Error(`Arquivo fora da pasta autorizada: ${relativePath}`);
	}
	const bytes = new Uint8Array(await readFile(target));
	if (bytes.length !== file.size || Bun.hash(bytes).toString() !== file.hash) {
		throw new Error(`O arquivo ${relativePath} mudou durante a leitura`);
	}

	return new TextDecoder().decode(bytes);
}

export async function exportSkillDirectoryText(dir: string) {
	const manifest = await inspectSkillDirectory(dir);
	const omittedBinaryPaths: string[] = [];
	const sections: string[] = [];
	let size = 0;
	const encoder = new TextEncoder();

	for (const file of manifest.files) {
		if (file.kind === "binary") {
			omittedBinaryPaths.push(file.path);
			continue;
		}
		if (file.size > SKILL_TEXT_FILE_LIMIT) {
			throw new Error(`O arquivo ${file.path} excede o limite de 1 MiB`);
		}

		const content = await readSkillDirectoryText({ dir, relativePath: file.path, manifest });
		const section = `===== ${JSON.stringify(file.path)} ${encoder.encode(content).length} =====\n${content}`;
		size += encoder.encode(`${sections.length ? "\n\n" : ""}${section}`).length;
		if (size > SKILL_TEXT_BUNDLE_LIMIT) {
			throw new Error(`A exportação textual excede o limite de 5 MiB em ${file.path}`);
		}
		sections.push(section);
	}

	return { content: sections.join("\n\n"), omittedBinaryPaths };
}

export type SkillDirectoryReplacement = {
	sourceDir: string;
	targetDir: string;
	expectedContentHash: string;
	expectedHash?: string;
	expectedTargetContentHash: string | null;
	expectedTargetHash?: string | null;
};

type PreparedSkillDirectoryReplacement = {
	replacement: SkillDirectoryReplacement;
	temporary: string;
	quarantine: string;
};

async function promoteSkillDirectories(prepared: PreparedSkillDirectoryReplacement[]) {
	const promoted: PreparedSkillDirectoryReplacement[] = [];

	try {
		for (const item of prepared) {
			if (await pathExists(item.replacement.targetDir)) {
				await rename(item.replacement.targetDir, item.quarantine);
			}
		}

		for (const item of prepared) {
			await rename(item.temporary, item.replacement.targetDir);
			promoted.push(item);
			const installed = await inspectSkillDirectory(item.replacement.targetDir);
			if (
				installed.contentHash !== item.replacement.expectedContentHash ||
				(item.replacement.expectedHash && installed.hash !== item.replacement.expectedHash)
			) {
				throw new Error(`Falha ao instalar ${item.replacement.targetDir}: verificação não bateu`);
			}
		}
	} catch (err) {
		const cleanup = await Promise.allSettled(
			promoted.map((item) => rm(item.replacement.targetDir, { recursive: true, force: true })),
		);
		const restore = await Promise.allSettled(
			prepared.toReversed().map(async (item) => {
				if (await pathExists(item.quarantine)) {
					await rename(item.quarantine, item.replacement.targetDir);
				}
			}),
		);
		const temporaryCleanup = await Promise.allSettled(
			prepared.map((item) => rm(item.temporary, { recursive: true, force: true })),
		);
		const rollbackErrors = [...cleanup, ...restore, ...temporaryCleanup]
			.filter((result) => result.status === "rejected")
			.map((result) => result.reason);
		if (rollbackErrors.length > 0) {
			const rollbackError = new AggregateError(
				[err, ...rollbackErrors],
				"Falha ao restaurar o lote de skills",
			);
			Object.assign(rollbackError, { cause: err });
			throw rollbackError;
		}
		throw err;
	}

	const quarantinePaths = (
		await Promise.all(
			prepared.map(async (item) => {
				return await rm(item.quarantine, { recursive: true, force: true })
					.then(() => null)
					.catch(() => item.quarantine);
			}),
		)
	).filter((path): path is string => path !== null);

	return { quarantinePaths };
}

export async function replaceSkillDirectories(replacements: SkillDirectoryReplacement[]) {
	const prepared: PreparedSkillDirectoryReplacement[] = [];

	try {
		const validated = await Promise.all(
			replacements.map(async (replacement) => {
				const source = await inspectSkillDirectory(replacement.sourceDir);
				if (
					source.contentHash !== replacement.expectedContentHash ||
					(replacement.expectedHash && source.hash !== replacement.expectedHash)
				) {
					throw new Error(`A origem ${replacement.sourceDir} mudou antes da cópia`);
				}
				const targetExists = await pathExists(replacement.targetDir);
				if (targetExists !== !!replacement.expectedTargetContentHash) {
					throw new Error(`O destino ${replacement.targetDir} mudou antes da cópia`);
				}
				if (targetExists) {
					const target = await inspectSkillDirectory(replacement.targetDir);
					if (
						target.contentHash !== replacement.expectedTargetContentHash ||
						(replacement.expectedTargetHash && target.hash !== replacement.expectedTargetHash)
					) {
						throw new Error(`O destino ${replacement.targetDir} mudou antes da cópia`);
					}
				}
				return { replacement, source };
			}),
		);
		const targetIdentities = await Promise.all(
			validated.map(({ replacement }) => canonicalTarget(replacement.targetDir)),
		);
		if (new Set(targetIdentities).size !== validated.length) {
			throw new Error("A operação contém destinos duplicados");
		}
		for (const [index, identity] of targetIdentities.entries()) {
			for (const other of targetIdentities.slice(index + 1)) {
				if (isContained(identity, other) || isContained(other, identity)) {
					throw new Error("A operação contém destinos sobrepostos");
				}
			}
			if (validated.some(({ source }) => source.canonicalRoot === identity)) {
				throw new Error("A origem e o destino da cópia coincidem");
			}
		}

		for (const { replacement, source } of validated) {
			await mkdir(dirname(replacement.targetDir), { recursive: true });
			const temporary = join(
				dirname(replacement.targetDir),
				`.${crypto.randomUUID()}.koworker-preparado`,
			);
			const quarantine = join(
				dirname(replacement.targetDir),
				`.${crypto.randomUUID()}.koworker-quarentena`,
			);
			prepared.push({ replacement, temporary, quarantine });
			await cp(source.canonicalRoot, temporary, { recursive: true, dereference: false });
			const preparedManifest = await inspectSkillDirectory(temporary);
			if (
				preparedManifest.contentHash !== replacement.expectedContentHash ||
				(replacement.expectedHash && preparedManifest.hash !== replacement.expectedHash)
			) {
				throw new Error(`Falha ao preparar ${replacement.targetDir}: verificação não bateu`);
			}
		}

		return await promoteSkillDirectories(prepared);
	} catch (err) {
		await Promise.all(prepared.map((item) => rm(item.temporary, { recursive: true, force: true })));
		throw err;
	}
}
