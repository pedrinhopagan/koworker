import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { resolveProcessTranscript } from "./process";

const roots: string[] = [];

afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function environment(pid: number, cli: "claude" | "codex", sessionId: string) {
	const root = await mkdtemp(join(tmpdir(), "kowork-proc-"));
	roots.push(root);
	const procRoot = join(root, "proc");
	const fd = join(procRoot, String(pid), "fd");
	const path =
		cli === "codex"
			? join(
					root,
					"home/pedro/.codex/sessions/2026/08/06",
					`rollout-2026-08-06T14-05-58-${sessionId}.jsonl`,
				)
			: join(root, "home/pedro/.claude/projects/-mnt-data-Projects-koworker", `${sessionId}.jsonl`);
	await mkdir(fd, { recursive: true });
	await mkdir(dirname(path), { recursive: true });
	await writeFile(
		path,
		`${JSON.stringify({ type: "session_meta", payload: { id: sessionId, source: "cli" } })}\n`,
	);
	await symlink(path, join(fd, "55"));

	return { root, procRoot, fd, path };
}

test("resolve o rollout exato aberto pelo processo do Codex", async () => {
	const sessionId = "019fd809-f3d0-7833-b9be-85386e512476";
	const { path, procRoot } = await environment(47395, "codex", sessionId);

	expect(
		await resolveProcessTranscript({
			agent: "codex",
			processIds: [47388, 47395],
			procRoot,
		}),
	).toEqual({
		cli: "codex",
		path,
		sessionId,
	});
});

test("resolve a sessão exata aberta pelo processo do Claude", async () => {
	const sessionId = "93156c4a-eefc-4d5c-8476-ebc230c92bef";
	const { path, procRoot } = await environment(8123, "claude", sessionId);

	expect(await resolveProcessTranscript({ agent: "claude", processIds: [8123], procRoot })).toEqual(
		{
			cli: "claude",
			path,
			sessionId,
		},
	);
});

test("resolve o registro de sessão do Claude quando o processo não mantém o JSONL aberto", async () => {
	const root = await mkdtemp(join(tmpdir(), "kowork-claude-session-"));
	roots.push(root);
	const processId = 365447;
	const sessionId = "8258af14-20ab-4aac-8f01-f5c09811e290";
	const claudeSessionsRoot = join(root, ".claude/sessions");
	const claudeProjectsRoot = join(root, ".claude/projects");
	const path = join(claudeProjectsRoot, "-mnt-data-Projects-dogama-app", `${sessionId}.jsonl`);
	await mkdir(claudeSessionsRoot, { recursive: true });
	await mkdir(dirname(path), { recursive: true });
	await writeFile(
		join(claudeSessionsRoot, `${processId}.json`),
		JSON.stringify({ pid: processId, sessionId, cwd: "/mnt/data/Projects/dogama-app" }),
	);
	await writeFile(path, `${JSON.stringify({ type: "last-prompt", sessionId })}\n`);

	expect(
		await resolveProcessTranscript({
			agent: "claude",
			processIds: [processId],
			procRoot: join(root, "proc"),
			claudeSessionsRoot,
			claudeProjectsRoot,
		}),
	).toEqual({ cli: "claude", path, sessionId });
});

test("recusa arquivo de outro CLI e mais de uma sessão raiz candidata", async () => {
	const firstId = "019fd809-f3d0-7833-b9be-85386e512476";
	const { root, procRoot, fd } = await environment(47395, "codex", firstId);

	expect(
		await resolveProcessTranscript({ agent: "claude", processIds: [47395], procRoot }),
	).toBeNull();

	const secondId = "019fd832-586e-7f50-bbf3-3baee1b15352";
	const second = join(
		root,
		"home/pedro/.codex/sessions/2026/08/06",
		`rollout-2026-08-06T14-50-05-${secondId}.jsonl`,
	);
	await writeFile(
		second,
		`${JSON.stringify({ type: "session_meta", payload: { id: secondId, source: "cli" } })}\n`,
	);
	await symlink(second, join(fd, "56"));

	expect(
		await resolveProcessTranscript({ agent: "codex", processIds: [47395], procRoot }),
	).toBeNull();
});

test("ignora rollouts de subagentes abertos pelo mesmo processo", async () => {
	const rootId = "019fd809-f3d0-7833-b9be-85386e512476";
	const { root, path, procRoot, fd } = await environment(47395, "codex", rootId);
	const childId = "019fd80a-b36d-7310-9603-7c3995d2aa36";
	const child = join(
		root,
		"home/pedro/.codex/sessions/2026/08/06",
		`rollout-2026-08-06T14-06-47-${childId}.jsonl`,
	);
	await writeFile(
		child,
		`${JSON.stringify({
			type: "session_meta",
			payload: {
				id: childId,
				source: { subagent: { thread_spawn: { parent_thread_id: rootId } } },
			},
		})}\n`,
	);
	await symlink(child, join(fd, "56"));

	expect(await resolveProcessTranscript({ agent: "codex", processIds: [47395], procRoot })).toEqual(
		{ cli: "codex", path, sessionId: rootId },
	);
});
