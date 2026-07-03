import { realpathSync } from "node:fs";

import { dbCategories } from "@/api/db/categories";
import { dbPriorities } from "@/api/db/priorities";
import { dbTasks } from "@/api/db/tasks";
import { TASK_COMPLEXITIES, type TaskComplexity } from "@/constants/complexity";

// Caminho real e normalizado: resolve symlinks (o main_route pode ter sido cadastrado por um
// symlink que o cwd já entrega resolvido) e tira a barra final.
export function canonicalPath(path: string): string {
	const normalized = path.replaceAll("\\", "/").replace(/\/$/, "");
	try {
		return realpathSync(normalized);
	} catch {
		return normalized;
	}
}

// Resolve a tarefa a partir de um taskId (uuid completo), de um caminho dentro de `.koworker/`
// (absoluto, relativo, ou apontando pra um arquivo dela) ou do id curto (8 chars) que nomeia a
// pasta. Devolve a row ou null.
export async function resolveTask(raw: string) {
	const marker = ".koworker/";
	const normalized = raw.replaceAll("\\", "/");

	const idx = normalized.indexOf(marker);
	if (idx !== -1) {
		const dir = normalized.slice(idx + marker.length).split("/")[0];
		if (!dir) return null;
		return dbTasks.getByFolderPath(`.koworker/${dir}`);
	}

	const byId = await dbTasks.getById(raw);
	if (byId) return byId;

	return dbTasks.getByFolderPath(`.koworker/${raw}`);
}

// A CLI é boundary: a cor é texto livre até provar o formato (mesma regra do schema da UI).
// `undefined` (flag ausente) passa direto — só valida o que foi informado.
export function assertHexColor(value: string | undefined): string | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
		throw new Error(`Cor inválida: ${value} (esperado #rrggbb, ex.: #3584e4)`);
	}
	return value;
}

// Categoria por nome (normalizado) ou por id. Erro quando nenhum casa.
export async function resolveCategoryId(arg: string): Promise<string> {
	const byName = await dbCategories.findByNormalizedName(arg);
	if (byName) return byName.id;

	const byId = await dbCategories.getById(arg);
	if (byId) return byId.id;

	throw new Error(`Categoria não encontrada: ${arg}`);
}

// Prioridade por nome (normalizado) ou por id. Erro quando nenhum casa.
export async function resolvePriorityId(arg: string): Promise<string> {
	const byName = await dbPriorities.findByNormalizedName(arg);
	if (byName) return byName.id;

	const byId = await dbPriorities.getById(arg);
	if (byId) return byId.id;

	throw new Error(`Prioridade não encontrada: ${arg}`);
}

// Complexidade é boundary: valida contra a união finita. Erro quando não casa.
export function resolveComplexity(arg: string): TaskComplexity {
	const value = arg.trim().toLowerCase();
	if ((TASK_COMPLEXITIES as readonly string[]).includes(value)) {
		return value as TaskComplexity;
	}

	throw new Error(`Complexidade inválida: ${arg} (use: ${TASK_COMPLEXITIES.join(", ")})`);
}
