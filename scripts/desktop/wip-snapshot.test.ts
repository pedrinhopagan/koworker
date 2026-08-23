import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveWorkingTreeSnapshot } from "./wip-snapshot";

let repoDir: string;

function git(args: string[], env?: Record<string, string>) {
	const result = Bun.spawnSync(["git", ...args], {
		cwd: repoDir,
		stdin: "ignore",
		stdout: "pipe",
		stderr: "pipe",
		env: env
			? {
					...process.env,
					GIT_AUTHOR_NAME: "Teste",
					GIT_AUTHOR_EMAIL: "teste@teste.local",
					GIT_COMMITTER_NAME: "Teste",
					GIT_COMMITTER_EMAIL: "teste@teste.local",
					...env,
				}
			: process.env,
	});

	if (result.exitCode !== 0) {
		throw new Error(result.stderr.toString() || `git ${args.join(" ")} falhou`);
	}

	return result.stdout.toString().trim();
}

beforeAll(async () => {
	repoDir = await mkdtemp(join(tmpdir(), "kowork-wip-snapshot-test-"));
	git(["init", "--initial-branch=dev"]);
	await writeFile(join(repoDir, "app.ts"), "export const a = 1;\n");
	git(["add", "."]);
	git(["commit", "-m", "base"]);
});

afterAll(async () => {
	await rm(repoDir, { force: true, recursive: true });
});

describe("resolveWorkingTreeSnapshot", () => {
	test("repositório limpo publica o próprio HEAD", async () => {
		const snapshot = await resolveWorkingTreeSnapshot(repoDir);

		expect(snapshot.dirty).toBe(false);
		expect(snapshot.commit).toBe(git(["rev-parse", "HEAD"]));
		expect(snapshot.label).toMatch(/^dev@[0-9a-f]{12}$/);
	});

	test("WIP não commitado entra no snapshot sem tocar no working tree", async () => {
		const headBefore = git(["rev-parse", "HEAD"]);
		await writeFile(join(repoDir, "app.ts"), "export const a = 2;\n");
		await writeFile(join(repoDir, "novo.ts"), "export const b = 3;\n");

		const snapshot = await resolveWorkingTreeSnapshot(repoDir);

		expect(snapshot.dirty).toBe(true);
		expect(snapshot.label).toMatch(/^dev@[0-9a-f]{12}\+wip$/);
		expect(snapshot.commit).not.toBe(headBefore);

		const builtFile = await readFile(join(repoDir, "app.ts"), "utf8");
		expect(builtFile).toContain("a = 2");
		expect(git(["status", "--porcelain"])).toMatch(/M app\.ts/);
		expect(git(["status", "--porcelain"])).toMatch(/\?\? novo\.ts/);

		const worktreeDir = await mkdtemp(join(tmpdir(), "kowork-wip-check-"));
		try {
			Bun.spawnSync(["git", "worktree", "add", "--detach", worktreeDir, snapshot.commit], {
				cwd: repoDir,
				stdio: ["ignore", "ignore", "ignore"],
			});
			const snapshotted = await readFile(join(worktreeDir, "app.ts"), "utf8");
			expect(snapshotted).toContain("a = 2");
			expect(await readFile(join(worktreeDir, "novo.ts"), "utf8")).toContain("b = 3");
		} finally {
			Bun.spawnSync(["git", "worktree", "remove", "--force", worktreeDir], {
				cwd: repoDir,
				stdio: ["ignore", "ignore", "ignore"],
			});
		}
	});

	test("arquivo deletado sem commit também entra na fotografia", async () => {
		await writeFile(join(repoDir, "rascunho.ts"), "export const c = 4;\n");
		git(["add", "."]);
		git(["commit", "-m", "com rascunho"]);
		await rm(join(repoDir, "rascunho.ts"));

		const snapshot = await resolveWorkingTreeSnapshot(repoDir);
		expect(snapshot.dirty).toBe(true);

		const worktreeDir = await mkdtemp(join(tmpdir(), "kowork-wip-del-"));
		try {
			Bun.spawnSync(["git", "worktree", "add", "--detach", worktreeDir, snapshot.commit], {
				cwd: repoDir,
				stdio: ["ignore", "ignore", "ignore"],
			});
			const exists = await readFile(join(worktreeDir, "rascunho.ts"), "utf8")
				.then(() => true)
				.catch(() => false);
			expect(exists).toBe(false);
		} finally {
			Bun.spawnSync(["git", "worktree", "remove", "--force", worktreeDir], {
				cwd: repoDir,
				stdio: ["ignore", "ignore", "ignore"],
			});
		}
	});
});
