import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { chmod, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_URL = ":memory:";
process.env.JWT_SECRET = "skills-sync-test-secret";
process.env.NODE_ENV = "development";

let db: typeof import("../db/connection").db;
let previewSkillSyncInFs: typeof import("./skills-sync").previewSkillSyncInFs;
let applySkillSyncInFs: typeof import("./skills-sync").applySkillSyncInFs;

const tempDirs: string[] = [];

beforeAll(async () => {
	({ db } = await import("../db/connection"));
	({ previewSkillSyncInFs, applySkillSyncInFs } = await import("./skills-sync"));
});

afterEach(async () => {
	await db.deleteFrom("skill_source_paths").execute();
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function root() {
	const path = await mkdtemp(join(tmpdir(), "skills-sync-"));
	tempDirs.push(path);
	return path;
}

async function addRoot(tool: string, path: string, scope = "global") {
	await db
		.insertInto("skill_source_paths")
		.values({ id: crypto.randomUUID(), tool, path, scope, created_at: Date.now() })
		.execute();
}

async function writeSkill(path: string, slug: string, body: string, asset?: string) {
	const skillPath = join(path, slug);
	await mkdir(skillPath, { recursive: true });
	await writeFile(
		join(skillPath, "SKILL.md"),
		`---\nname: ${slug}\ndescription: ${slug}\n---\n\n${body}\n`,
	);
	if (asset) {
		await mkdir(join(skillPath, "references"), { recursive: true });
		await writeFile(join(skillPath, "references", "guide.md"), asset);
	}
}

describe("previewSkillSyncInFs", () => {
	test("marca conflito só quando o conteúdo difere e lista as CLIs sem a skill", async () => {
		const opencode = await root();
		const claude = await root();
		const agents = await root();
		const custom = await root();
		await addRoot("opencode", opencode);
		await addRoot("claude-code", claude);
		await addRoot("agents", agents);
		await addRoot("codex", custom, "custom");
		await writeSkill(opencode, "shared", "mesmo corpo", "guia A");
		await writeSkill(claude, "shared", "mesmo corpo", "guia B");
		await writeSkill(custom, "custom-only", "fora do sync");

		const plan = await previewSkillSyncInFs();

		expect(plan.skills).toHaveLength(1);
		expect(plan.skills[0].slug).toBe("shared");
		expect(plan.skills[0].conflict).toBe(true);
		expect(plan.skills[0].missingTools).toEqual(["agents"]);
		expect(plan.totals.toCreate).toBe(1);
	});

	test("não marca conflito quando só as permissões diferem", async () => {
		const opencode = await root();
		const claude = await root();
		await addRoot("opencode", opencode);
		await addRoot("claude-code", claude);
		await writeSkill(opencode, "same", "mesmo corpo", "mesmo guia");
		await writeSkill(claude, "same", "mesmo corpo", "mesmo guia");
		await chmod(join(claude, "same", "SKILL.md"), 0o755);

		const plan = await previewSkillSyncInFs();

		expect(plan.skills[0].conflict).toBe(false);
		expect(plan.totals.conflicts).toBe(0);
		expect(plan.totals.toCreate).toBe(0);
		expect(plan.totals.toUpdate).toBe(0);
	});

	test("rejeita symlink interno antes do backup", async () => {
		const opencode = await root();
		const agents = await root();
		const external = await root();
		await addRoot("opencode", opencode);
		await addRoot("agents", agents);
		await writeSkill(opencode, "unsafe", "corpo");
		await writeFile(join(external, "secret.txt"), "segredo");
		await symlink(join(external, "secret.txt"), join(opencode, "unsafe", "secret.txt"));

		let error: Error | null = null;
		try {
			await previewSkillSyncInFs();
		} catch (err: any) {
			error = err;
		}

		expect(error?.message).toContain("Link interno não suportado");
	});
});

describe("applySkillSyncInFs", () => {
	test("replica a versão escolhida para todas as CLIs sem apagar as fontes", async () => {
		const opencode = await root();
		const claude = await root();
		const agents = await root();
		await addRoot("opencode", opencode);
		await addRoot("claude-code", claude);
		await addRoot("agents", agents);
		await writeSkill(opencode, "shared", "versão opencode", "guia opencode");
		await writeSkill(claude, "shared", "versão claude", "guia claude");
		await writeSkill(agents, "shared", "versão agents", "guia agents");
		await writeSkill(opencode, "single", "única", "guia único");

		const plan = await previewSkillSyncInFs();
		const shared = plan.skills.find((skill) => skill.slug === "shared");
		const chosen = shared?.sources.find((source) => source.tool === "claude-code");
		if (!chosen) {
			throw new Error("Fonte Claude não encontrada no plano");
		}

		const result = await applySkillSyncInFs({
			planHash: plan.planHash,
			choices: [{ slug: "shared", sourcePath: chosen.path, hash: chosen.hash }],
		});
		if (result.backupPath) {
			tempDirs.push(result.backupPath);
		}

		expect(result.updated).toBe(2);
		expect(result.created).toBe(2);
		for (const dir of [opencode, claude, agents]) {
			expect(await readFile(join(dir, "shared", "references", "guide.md"), "utf8")).toBe(
				"guia claude",
			);
			expect(await readFile(join(dir, "single", "references", "guide.md"), "utf8")).toBe(
				"guia único",
			);
		}
		expect(
			await Bun.file(join(result.backupPath ?? "", "opencode", "shared", "SKILL.md")).exists(),
		).toBe(true);
		expect(
			await Bun.file(join(result.backupPath ?? "", "agents", "shared", "SKILL.md")).exists(),
		).toBe(true);
		expect(await Bun.file(join(result.backupPath ?? "", "manifest.json")).exists()).toBe(true);
	});

	test("recusa um plano alterado antes de criar o backup", async () => {
		const opencode = await root();
		const agents = await root();
		await addRoot("opencode", opencode);
		await addRoot("agents", agents);
		await writeSkill(opencode, "moving", "primeira versão");
		const plan = await previewSkillSyncInFs();
		await writeSkill(opencode, "moving", "segunda versão");

		let error: Error | null = null;
		try {
			await applySkillSyncInFs({ planHash: plan.planHash, choices: [] });
		} catch (err: any) {
			error = err;
		}

		expect(error?.message).toContain("mudaram desde a análise");
		expect(await readFile(join(opencode, "moving", "SKILL.md"), "utf8")).toContain(
			"segunda versão",
		);
	});

	test("preserva symlink com conteúdo igual e materializa a cópia nas CLIs sem a skill", async () => {
		const opencode = await root();
		const agents = await root();
		const source = await root();
		await addRoot("opencode", opencode);
		await addRoot("agents", agents);
		await writeSkill(source, "linked", "corpo", "guia");
		await symlink(join(source, "linked"), join(opencode, "linked"));

		const plan = await previewSkillSyncInFs();
		const linked = plan.skills.find((skill) => skill.slug === "linked");
		expect(linked?.sources[0].entryType).toBe("symlink");
		expect(linked?.conflict).toBe(false);

		const result = await applySkillSyncInFs({ planHash: plan.planHash, choices: [] });
		if (result.backupPath) {
			tempDirs.push(result.backupPath);
		}

		expect(result.created).toBe(1);
		expect(result.updated).toBe(0);
		expect((await lstat(join(opencode, "linked"))).isSymbolicLink()).toBe(true);
		expect((await lstat(join(agents, "linked"))).isDirectory()).toBe(true);
		expect(await readFile(join(agents, "linked", "SKILL.md"), "utf8")).toContain("corpo");
	});
});
