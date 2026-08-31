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
