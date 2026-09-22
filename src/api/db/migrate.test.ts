import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = await mkdtemp(join(tmpdir(), "koworker-storage-migrate-"));
let result: {
	content: string;
	first: { folder_path: string; storage_key: string | null; storage_slug: string | null }[];
	firstGroups: { id: string; color: string }[];
	mtimePreserved: boolean;
	pathIndex: { name: string } | null;
	projectRoutes: {
		name: string;
		command: string;
		icon: string;
		route: string;
	}[];
	firstSessions: {
		id: string;
		status: string;
		end_reason: string | null;
		ended_at: number | null;
		updated_at: number;
	}[];
	second: { folder_path: string; storage_key: string | null; storage_slug: string | null }[];
	secondGroups: { id: string; color: string }[];
	tables: string[];
	backups: string[];
	secondSessions: {
		id: string;
		status: string;
		end_reason: string | null;
		ended_at: number | null;
		updated_at: number;
	}[];
};

beforeAll(async () => {
	const child = Bun.spawn([process.execPath, "run", "src/api/db/migrate-test-runner.ts", root], {
		cwd: process.cwd(),
		stdout: "pipe",
		stderr: "pipe",
	});
	const [exitCode, stdout, stderr] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);
	if (exitCode !== 0) {
		throw new Error(stderr);
	}

	result = JSON.parse(stdout);
});

afterAll(async () => {
	await rm(root, { recursive: true, force: true });
});

describe("ensureDbSchema", () => {
	test("faz backfill idempotente sem alterar folder_path nem o workspace", () => {
		expect(result.first).toEqual(result.second);
		expect(result.first.map((task) => task.storage_key)).toEqual(["12345678", "12345678bbbb"]);
		expect(result.first.map((task) => task.storage_slug)).toEqual([null, null]);
		expect(result.first.map((task) => task.folder_path)).toEqual([
			".koworker/adotada",
			".koworker/adotada",
		]);
		expect(result.content).toBe("# Preservada\n");
		expect(result.mtimePreserved).toBeTrue();
	});

	test("banco novo nasce sem classificação e sem backup", () => {
		expect(result.tables).not.toContain("categories");
		expect(result.tables).not.toContain("priorities");
		expect(result.backups).toEqual([]);
	});

	test("mantém duplicatas legadas visíveis para preflight sem derrubar o boot", () => {
		expect(result.pathIndex).toBeNull();
	});

	test("troca features pretas por cores distintas em todos os projetos", () => {
		expect(result.firstGroups).toEqual(result.secondGroups);
		expect(result.firstGroups).toEqual([
			{ id: "11111111-0000-4000-8000-000000000001", color: "#6366f1" },
			{ id: "22222222-0000-4000-8000-000000000002", color: "#0ea5e9" },
			{ id: "33333333-0000-4000-8000-000000000003", color: "#10b981" },
			{ id: "44444444-0000-4000-8000-000000000004", color: "#6366f1" },
		]);
	});

	test("atualiza os ícones, remove o atalho legado e adiciona o pi uma única vez", () => {
		expect(result.projectRoutes).toEqual([
			{
				name: "claude",
				command: "claude --dangerously-skip-permissions",
				icon: "Bot",
				route: join(root, "project"),
			},
			{
				name: "Iniciar jogo",
				command: "bun run jogo:iniciar",
				icon: "Gamepad2",
				route: join(root, "project"),
			},
			{
				name: "Deploy",
				command: "bun run deploy",
				icon: "Rocket",
				route: join(root, "project"),
			},
			{
				name: "pi",
				command: "pi",
				icon: "SquareTerminal",
				route: join(root, "project"),
			},
		]);
	});

	test("encerra sessões legadas vivas uma única vez", () => {
		expect(result.firstSessions).toEqual(result.secondSessions);
		expect(result.firstSessions[0]).toMatchObject({
			id: "legacy-ended",
			status: "ended",
			end_reason: "Motivo original",
			ended_at: 2,
			updated_at: 2,
		});
		expect(result.firstSessions[1]).toMatchObject({
			id: "legacy-live",
			status: "ended",
			end_reason: "Sessão encerrada pela migração para conversas no terminal.",
		});
		expect(result.firstSessions[1]?.ended_at).toBe(result.firstSessions[1]?.updated_at);
	});
});

type ClassificationResult = {
	backups: string[];
	brokenForeignKeys: unknown[];
	restored: {
		categories: { id: string }[];
		tasks: { id: string; category_id: string | null; complexity: string }[];
	} | null;
	run: { id: string; kind: string; task_id: string | null; stage: string | null };
	session: { id: string; task_id: string | null };
	tables: string[];
	taskColumns: string[];
	taskIndexes: string[];
	tasks: Record<string, unknown>[];
};

async function runClassificationRunner(root: string, phase?: string) {
	const child = Bun.spawn(
		[
			process.execPath,
			"run",
			"src/api/db/migrate-classification-test-runner.ts",
			root,
			...(phase ? [phase] : []),
		],
		{ cwd: process.cwd(), stdout: "pipe", stderr: "pipe" },
	);
	const [exitCode, stdout, stderr] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);
	if (exitCode !== 0) {
		throw new Error(stderr);
	}

	return JSON.parse(stdout.trim().split("\n").at(-1) ?? "") as ClassificationResult;
}

describe("remoção da classificação antiga", () => {
	const legacyRoot = mkdtemp(join(tmpdir(), "koworker-classificacao-"));
	let migrated: ClassificationResult;
	let rebooted: ClassificationResult;

	beforeAll(async () => {
		migrated = await runClassificationRunner(await legacyRoot, "legado");
		rebooted = await runClassificationRunner(await legacyRoot);
	});

	afterAll(async () => {
		await rm(await legacyRoot, { recursive: true, force: true });
	});

	test("remove colunas e tabelas antigas preservando tarefas e vínculos", () => {
		expect(migrated.taskColumns).not.toContain("category_id");
		expect(migrated.taskColumns).not.toContain("priority_id");
		expect(migrated.taskColumns).not.toContain("complexity");
		expect(migrated.tables).not.toContain("categories");
		expect(migrated.tables).not.toContain("priorities");
		expect(migrated.tables).toContain("skill_categories");
		expect(migrated.tables).toContain("agent_categories");
		expect(migrated.brokenForeignKeys).toEqual([]);
		expect(migrated.taskIndexes).toContain("tasks_project_id_idx");
		expect(migrated.taskIndexes).toContain("tasks_storage_key_unique_idx");
		expect(migrated.tasks).toEqual([
			{
				id: "12345678-aaaa-4000-8000-000000000001",
				project_id: "aaaaaaaa-0000-4000-8000-000000000001",
				folder_path: ".koworker/tasks/feature--feat0001/primeira--12345678",
				title: "Primeira",
				group_id: "11111111-0000-4000-8000-000000000001",
				display_order: 0,
				file_order: null,
				storage_key: "12345678",
				storage_slug: "primeira",
				done: 0,
				completed_at: null,
				deleted_at: null,
			},
			expect.objectContaining({
				id: "12345678-bbbb-4000-8000-000000000002",
				folder_path: ".koworker/tasks/_sem-feature/segunda",
				file_order: '["index.md"]',
				done: 1,
			}),
			expect.objectContaining({
				id: "12345678-cccc-4000-8000-000000000003",
				folder_path: ".koworker/tasks/_sem-feature/apagada",
			}),
		]);
		expect(Number(migrated.tasks[2]?.deleted_at)).toBe(4);
		expect(migrated.run).toEqual({
			id: "run-flow",
			kind: "flow",
			task_id: "12345678-aaaa-4000-8000-000000000001",
			stage: "plano",
		});
		expect(migrated.session).toEqual({
			id: "sessao",
			task_id: "12345678-bbbb-4000-8000-000000000002",
		});
	});

	test("guarda um backup restaurável com a classificação original", () => {
		expect(migrated.backups).toHaveLength(1);
		expect(migrated.restored?.categories).toEqual([{ id: "cat-1" }, { id: "cat-2" }]);
		expect(migrated.restored?.tasks.map((task) => [task.category_id, task.complexity])).toEqual([
			["cat-1", "alto"],
			["cat-2", "medio"],
			[null, "medio"],
		]);
	});

	test("um novo boot não recria a classificação nem outro backup, nem quando um binário antigo recria as tabelas vazias", () => {
		expect(rebooted.tables).toEqual(migrated.tables);
		expect(rebooted.taskColumns).toEqual(migrated.taskColumns);
		expect(rebooted.tasks).toEqual(migrated.tasks);
		expect(rebooted.backups).toEqual(migrated.backups);
	});
});
