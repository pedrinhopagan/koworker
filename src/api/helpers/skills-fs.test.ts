import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_URL = ":memory:";
process.env.JWT_SECRET = "skills-fs-test-secret";
process.env.NODE_ENV = "development";

let db: typeof import("../db/connection").db;
let listSkillsFromFs: typeof import("./skills-fs").listSkillsFromFs;
let updateSkillInFs: typeof import("./skills-fs").updateSkillInFs;

const home = homedir();
const tempDirs: string[] = [];

beforeAll(async () => {
	({ db } = await import("../db/connection"));
	({ listSkillsFromFs, updateSkillInFs } = await import("./skills-fs"));
});

afterEach(async () => {
	await db.deleteFrom("skill_source_paths").execute();
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function addRow(tool: string, path: string, scope: string, createdAt: number) {
	await db
		.insertInto("skill_source_paths")
		.values({ id: crypto.randomUUID(), tool, path, scope, created_at: createdAt })
		.execute();
}

async function writeSkill(dir: string, slug: string, description: string, body: string) {
	const skillDir = join(dir, slug);
	await mkdir(skillDir, { recursive: true });
	await writeFile(
		join(skillDir, "SKILL.md"),
		`---\nname: ${slug}\ndescription: ${description}\n---\n\n${body}\n`,
	);
}

async function homeDir(): Promise<string> {
	const dir = join(home, `.koworker-test-${crypto.randomUUID()}`);
	await mkdir(dir, { recursive: true });
	tempDirs.push(dir);
	return dir;
}

describe("listSkillsFromFs", () => {
	test("expande o til dos paths da tabela e lista a skill da fonte", async () => {
		const dir = await homeDir();
		await writeSkill(dir, "til-skill", "descricao til", "corpo til");
		await addRow("opencode", `~/${dir.slice(home.length + 1)}`, "custom", 1);

		const found = (await listSkillsFromFs()).find((record) => record.slug === "til-skill");

		expect(found).toBeDefined();
		expect(found?.sources).toHaveLength(1);
	});

	test("lista skill cuja pasta é um symlink", async () => {
		const dir = await homeDir();
		const real = await homeDir();
		await writeSkill(real, "link-skill", "descricao link", "corpo link");
		const { symlink } = await import("node:fs/promises");
		await symlink(join(real, "link-skill"), join(dir, "link-skill"));
		await addRow("claude-code", dir, "global", 1);

		const found = (await listSkillsFromFs()).find((record) => record.slug === "link-skill");

		expect(found).toBeDefined();
	});

	test("deduplica roots que resolvem para o mesmo diretório (til e absoluto)", async () => {
		const dir = await homeDir();
		await writeSkill(dir, "dup-skill", "descricao dup", "corpo dup");
		await addRow("claude-code", `~/${dir.slice(home.length + 1)}`, "custom", 1);
		await addRow("claude-code", dir, "global", 2);

		const found = (await listSkillsFromFs()).find((record) => record.slug === "dup-skill");

		expect(found?.sources).toHaveLength(1);
		expect(found?.conflict).toBe(false);
	});
});

describe("updateSkillInFs", () => {
	test("grava sempre na fonte global Agents", async () => {
		const cli = await homeDir();
		const agents = await homeDir();
		await writeSkill(cli, "canonical", "descrição CLI", "corpo CLI");
		await addRow("opencode", cli, "global", 1);
		await addRow("agents", agents, "global", 2);

		await updateSkillInFs({
			slug: "canonical",
			description: "descrição Agents",
			content: "corpo Agents",
		});

		expect(await readFile(join(cli, "canonical", "SKILL.md"), "utf8")).toContain("corpo CLI");
		expect(await readFile(join(agents, "canonical", "SKILL.md"), "utf8")).toContain("corpo Agents");
	});
});
