import { dbProjects } from "@/api/db/projects";
import { dbTaskGroups } from "@/api/db/task-groups";
import { normalizeEntityName } from "@/api/db/entity-name";
import { withProjectStorageLock } from "@/api/helpers/task-storage-coordinator";
import { allocateStorageKey, normalizeStorageSlug } from "@/api/helpers/task-storage-path";
import { parseArgs } from "../args";
import { resolveProjectByCwd } from "../resolve";

export function runFeature(args: string[]): Promise<void> {
	const [sub, ...rest] = args;

	if (sub === "list" || sub === "ls") {
		return runFeatureList(rest);
	}
	if (sub === "create" || sub === "new") {
		return runFeatureCreate(rest);
	}

	throw new Error(
		`Subcomando desconhecido: feature ${sub ?? ""}. Use: feature list | feature create`,
	);
}

async function runFeatureList(args: string[]): Promise<void> {
	const { positionals, flags } = parseArgs(args);
	const project = await resolveFeatureProject(flags.project);
	const search = normalizeEntityName(positionals.join(" ").trim());
	const groups = (await dbTaskGroups.listByProject(project.id)).filter(
		(group) => !search || normalizeEntityName(group.name).includes(search),
	);

	if (groups.length === 0) {
		console.log("Nenhuma feature encontrada.");
		return;
	}

	console.log("id\tstorage_key\tordem\tnome");
	for (const group of groups) {
		console.log(`${group.id}\t${group.storage_key ?? "-"}\t${group.display_order}\t${group.name}`);
	}
}

async function runFeatureCreate(args: string[]): Promise<void> {
	const { positionals, flags } = parseArgs(args);
	const name = positionals.join(" ").trim();
	if (!name) {
		throw new Error("Uso: kw-cli feature create <nome> [--project <id>]");
	}

	const project = await resolveFeatureProject(flags.project);
	const existing = (await dbTaskGroups.listByProject(project.id)).find(
		(group) => normalizeEntityName(group.name) === normalizeEntityName(name),
	);
	if (existing) {
		throw new Error(`A feature "${existing.name}" já existe neste projeto: ${existing.id}`);
	}
	const id = await withProjectStorageLock(
		{ projectId: project.id, projectRoute: project.main_route },
		async () => {
			const nextId = crypto.randomUUID();
			const storageKey = allocateStorageKey({
				id: nextId,
				usedKeys: new Set(
					(await dbTaskGroups.listStorageKeys()).flatMap((row) =>
						row.storage_key ? [row.storage_key] : [],
					),
				),
			});

			await dbTaskGroups.create({
				id: nextId,
				project_id: project.id,
				name,
				storage_key: storageKey,
				storage_slug: normalizeStorageSlug(name, "feature"),
			});

			return nextId;
		},
	);

	console.log(`✅ Feature "${name}" criada.`);
	console.log(`featureId: ${id}`);
}

async function resolveFeatureProject(projectArg: string | undefined) {
	if (projectArg !== undefined) {
		const projectId = projectArg.trim();
		if (!projectId) {
			throw new Error("Informe um projeto válido em --project.");
		}

		const project = await dbProjects.getById(projectId);
		if (!project) {
			throw new Error(`Projeto não encontrado: ${projectId}`);
		}

		return project;
	}

	const project = await resolveProjectByCwd();
	if (!project) {
		throw new Error(
			`Nenhum projeto koworker registrado para ${process.cwd()}. Rode 'kw-cli project create' antes de gerenciar features.`,
		);
	}

	return project;
}
