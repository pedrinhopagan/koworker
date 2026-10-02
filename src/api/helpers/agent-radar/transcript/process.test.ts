import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import dayjs from "dayjs";

import { piSessionDir, resolveProcessTranscript } from "./process";

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

test("resolve Codex com CODEX_HOME personalizado pelo arquivo aberto", async () => {
	const sessionId = "019fd809-f3d0-7833-b9be-85386e512476";
	const { root, procRoot, fd } = await environment(9123, "codex", sessionId);
	await rm(join(fd, "55"));
	const path = join(
		root,
		".codex-personal/sessions/2026/09/22",
		`rollout-personal-${sessionId}.jsonl`,
	);
	await mkdir(dirname(path), { recursive: true });
	await writeFile(
		path,
		`${JSON.stringify({ type: "session_meta", payload: { id: sessionId, source: "cli" } })}\n`,
	);
	await symlink(path, join(fd, "55"));

	expect(await resolveProcessTranscript({ agent: "codex", processIds: [9123], procRoot })).toEqual({
		cli: "codex",
		path,
		sessionId,
	});
});

async function piEnvironment(pid: number, args: string[]) {
	const root = await mkdtemp(join(tmpdir(), "kowork-pi-"));
	roots.push(root);
	const procRoot = join(root, "proc");
	const cwd = join(root, "projeto");
	const sessionsRoot = join(root, "sessions");
	const directory = piSessionDir(cwd, sessionsRoot);
	await mkdir(join(procRoot, String(pid)), { recursive: true });
	await mkdir(cwd, { recursive: true });
	await mkdir(directory, { recursive: true });
	await writeFile(
		join(procRoot, String(pid), "cmdline"),
		["node", "/usr/bin/pi", ...args].join("\0"),
	);
	await writeFile(join(procRoot, String(pid), "stat"), `${pid} (node) S ${"0 ".repeat(16)}0 0\n`);
	await writeFile(join(procRoot, "stat"), "btime 0\n");
	await symlink(cwd, join(procRoot, String(pid), "cwd"));

	return { procRoot, directory, sessionsRoot };
}

test("resolve a sessão do Pi pelo id passado na linha de comando", async () => {
	const { procRoot, directory, sessionsRoot } = await piEnvironment(9001, [
		"--session-id",
		"sessao-exata",
	]);
	const path = join(directory, "2026-09-22T10-00-00-000Z_sessao-exata.jsonl");
	await writeFile(join(directory, "2026-09-22T11-00-00-000Z_outra.jsonl"), "{}\n");
	await writeFile(path, "{}\n");

	expect(
		await resolveProcessTranscript({
			agent: "pi",
			processIds: [9001],
			procRoot,
			piSessionsRoot: sessionsRoot,
		}),
	).toEqual({ cli: "pi", path, sessionId: "sessao-exata" });
});

test("sem id, o Pi usa a sessão da pasta do projeto gravada por último", async () => {
	const { procRoot, directory, sessionsRoot } = await piEnvironment(9002, []);
	const older = join(directory, "2026-09-22T10-00-00-000Z_01a0-antiga.jsonl");
	const newer = join(directory, "2026-09-22T11-00-00-000Z_01a0-nova.jsonl");
	await writeFile(older, "{}\n");
	await utimes(older, new Date(1_000_000), new Date(1_000_000));
	await writeFile(newer, "{}\n");

	expect(
		await resolveProcessTranscript({
			agent: "pi",
			processIds: [9002],
			procRoot,
			piSessionsRoot: sessionsRoot,
		}),
	).toEqual({ cli: "pi", path: newer, sessionId: "01a0-nova" });
	expect(
		await resolveProcessTranscript({
			agent: "pi",
			processIds: [9003],
			procRoot,
			piSessionsRoot: sessionsRoot,
		}),
	).toBeNull();
});

function uuid7(ms: number, tail: string) {
	const hex = `${ms.toString(16).padStart(12, "0")}7${tail.padEnd(19, "0")}`;

	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function codexEnvironment(args: string[]) {
	const root = await mkdtemp(join(tmpdir(), "kowork-codex-"));
	roots.push(root);
	const pid = 7001;
	const procRoot = join(root, "proc");
	const cwd = join(root, "repo");
	const home = join(root, "personal");
	const startedAt = Date.now() - 60_000;
	await mkdir(join(procRoot, String(pid)), { recursive: true });
	await mkdir(cwd, { recursive: true });
	await writeFile(
		join(procRoot, String(pid), "cmdline"),
		["node", "/usr/bin/codex", ...args].join("\0"),
	);
	await writeFile(join(procRoot, String(pid), "environ"), `PATH=/usr/bin\0CODEX_HOME=${home}\0`);
	await writeFile(
		join(procRoot, String(pid), "stat"),
		`${pid} (node) S ${"0 ".repeat(18)}${Math.floor((startedAt % 1000) / 10)} 0\n`,
	);
	await writeFile(join(procRoot, "stat"), `btime ${Math.floor(startedAt / 1000)}\n`);
	await symlink(cwd, join(procRoot, String(pid), "cwd"));

	async function rollout(input: {
		home?: string;
		bornAt: number;
		tail: string;
		cwd?: string;
		source?: unknown;
		originator?: string;
	}) {
		const id = uuid7(input.bornAt, input.tail);
		const path = join(
			input.home ?? home,
			"sessions",
			dayjs(input.bornAt).format("YYYY/MM/DD"),
			`rollout-${dayjs(input.bornAt).format("YYYY-MM-DDTHH-mm-ss")}-${id}.jsonl`,
		);
		await mkdir(dirname(path), { recursive: true });
		await writeFile(
			path,
			`${JSON.stringify({
				type: "session_meta",
				payload: {
					id,
					cwd: input.cwd ?? cwd,
					source: input.source ?? "vscode",
					originator: input.originator ?? "codex-tui",
				},
			})}\n`,
		);

		return { id, path };
	}

	return { root, pid, procRoot, startedAt, rollout };
}

test("codex 0.157 sem rollout aberto: a sessão nova é a do TUI nascida no cwd depois do processo", async () => {
	const { root, pid, procRoot, startedAt, rollout } = await codexEnvironment(["--yolo"]);
	await rollout({ bornAt: startedAt - 3_600_000, tail: "1" });
	await rollout({ bornAt: startedAt + 20_000, tail: "2", originator: "Claude Code" });
	await rollout({ bornAt: startedAt + 25_000, tail: "3", cwd: "/outro" });
	await rollout({
		bornAt: startedAt + 30_000,
		tail: "4",
		source: { subagent: { thread_spawn: {} } },
	});
	await rollout({ home: join(root, "default"), bornAt: startedAt + 35_000, tail: "5" });
	const session = await rollout({ bornAt: startedAt + 10_000, tail: "6" });

	expect(
		await resolveProcessTranscript({
			agent: "codex",
			processIds: [pid],
			procRoot,
			codexHome: join(root, "default"),
		}),
	).toEqual({ cli: "codex", path: session.path, sessionId: session.id });
});

test("codex retomado sem rollout aberto resolve pelo id do resume, e o id reportado vence", async () => {
	const { pid, procRoot, startedAt, rollout } = await codexEnvironment([]);
	const resumed = await rollout({ bornAt: startedAt - 86_400_000, tail: "a" });
	const reported = await rollout({ bornAt: startedAt + 5_000, tail: "b" });
	await writeFile(
		join(procRoot, String(pid), "cmdline"),
		["node", "/usr/bin/codex", "--yolo", "resume", resumed.id].join("\0"),
	);

	expect(await resolveProcessTranscript({ agent: "codex", processIds: [pid], procRoot })).toEqual({
		cli: "codex",
		path: resumed.path,
		sessionId: resumed.id,
	});
	expect(
		await resolveProcessTranscript({
			agent: "codex",
			processIds: [pid],
			procRoot,
			sessionId: reported.id,
		}),
	).toEqual({ cli: "codex", path: reported.path, sessionId: reported.id });
});

test("rollout aberto do codex 0.157, com source vscode, continua sendo a sessão principal", async () => {
	const sessionId = "019fd809-f3d0-7833-b9be-85386e512476";
	const { path, procRoot } = await environment(47395, "codex", sessionId);
	await writeFile(
		path,
		`${JSON.stringify({ type: "session_meta", payload: { id: sessionId, source: "vscode" } })}\n`,
	);

	expect(await resolveProcessTranscript({ agent: "codex", processIds: [47395], procRoot })).toEqual(
		{ cli: "codex", path, sessionId },
	);
});
