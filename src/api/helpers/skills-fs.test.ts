import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_URL = ":memory:";
process.env.JWT_SECRET = "skills-fs-test-secret";
process.env.NODE_ENV = "development";

let db: typeof import("../db/connection").db;
let dbSkillSettings: typeof import("../db/skill-settings").dbSkillSettings;
let deleteAllSkillInFs: typeof import("./skills-fs").deleteAllSkillInFs;
let deleteSkillInFs: typeof import("./skills-fs").deleteSkillInFs;
let getSkillFromFs: typeof import("./skills-fs").getSkillFromFs;
let listSkillsFromFs: typeof import("./skills-fs").listSkillsFromFs;
let previewSkillStandardizationInFs: typeof import("./skills-fs").previewSkillStandardizationInFs;
let renameSkillInFs: typeof import("./skills-fs").renameSkillInFs;
let standardizeSkillInFs: typeof import("./skills-fs").standardizeSkillInFs;
let skillContentHash: typeof import("./skills-fs").skillContentHash;
let updateSkillInFs: typeof import("./skills-fs").updateSkillInFs;

const home = homedir();
const tempDirs: string[] = [];
const projectIds: string[] = [];

beforeAll(async () => {
	({ db } = await import("../db/connection"));
	({ dbSkillSettings } = await import("../db/skill-settings"));
	({
		deleteAllSkillInFs,
		deleteSkillInFs,
		getSkillFromFs,
		listSkillsFromFs,
		previewSkillStandardizationInFs,
		renameSkillInFs,
		skillContentHash,
		standardizeSkillInFs,
		updateSkillInFs,
	} = await import("./skills-fs"));
});

describe("deleteSkillInFs", () => {
	test("remove somente uma variante descoberta e preserva paths inventados", async () => {
		const parent = await homeDir();
		const root = join(parent, "authorized");
		const victim = join(parent, "victim");
		await writeSkill(root, "safe-delete", "autorizada", "autorizada");
		await writeSkill(victim, "safe-delete", "fora", "fora");
		await addRow("agents", root, "global", 1);
		const skill = await getSkillFromFs("safe-delete");
		const variant = skill?.variants.at(0);
		if (!variant) {
			throw new Error("Variante não encontrada");
		}

		let error: Error | null = null;
		try {
			await deleteSkillInFs({
				slug: "safe-delete",
				variantPath: join(victim, "safe-delete", "SKILL.md"),
			});
		} catch (err: any) {
			error = err;
		}
		expect(error?.message).toContain("não encontrada");
		expect(await Bun.file(join(victim, "safe-delete", "SKILL.md")).exists()).toBe(true);

		await deleteSkillInFs({ slug: "safe-delete", variantPath: variant.path });
		expect(await Bun.file(variant.path).exists()).toBe(false);
	});
});

describe("deleteAllSkillInFs", () => {
	test("ignora roots de projeto cujo diretório pai é um arquivo", async () => {
		const project = await homeDir();
		const projectId = crypto.randomUUID();
		projectIds.push(projectId);
		await writeFile(join(project, ".codex"), "arquivo");
		await db
			.insertInto("projects")
			.values({
				id: projectId,
				name: "Projeto com arquivo .codex",
				color: "#000000",
				display_order: 0,
				main_route: project,
				hide_terminal: 0,
				task_layout_version: 1,
				created_at: Date.now(),
			})
			.execute();

		let error: Error | null = null;
		try {
			await deleteAllSkillInFs({ slug: "skill-inexistente" });
		} catch (err: any) {
			error = err;
		}

		expect(error?.message).toBe("Skill não encontrada");
	});

	test("cria backup verificado e remove a skill de todos os projetos", async () => {
		const global = await homeDir();
		const firstProject = await homeDir();
		const secondProject = await homeDir();
		await writeSkill(global, "delete-everywhere", "global", "global");
		await writeSkill(
			join(firstProject, ".agents/skills"),
			"delete-everywhere",
			"primeiro",
			"primeiro",
		);
		await writeSkill(
			join(secondProject, ".codex/skills"),
			"delete-everywhere",
			"segundo",
			"segundo",
		);
		await addRow("agents", global, "global", 1);
		await dbSkillSettings.upsert({
			slug: "delete-everywhere",
			label: "Skill descartável",
			icon: "Trash2",
			color: "#123456",
			quickInvoke: true,
		});

		for (const [index, mainRoute] of [firstProject, secondProject].entries()) {
			const projectId = crypto.randomUUID();
			projectIds.push(projectId);
			await db
				.insertInto("projects")
				.values({
					id: projectId,
					name: `Projeto ${index + 1}`,
					color: "#000000",
					display_order: index,
					main_route: mainRoute,
					hide_terminal: 0,
					task_layout_version: 1,
					created_at: Date.now(),
				})
				.execute();
		}

		const result = await deleteAllSkillInFs({ slug: "delete-everywhere" });
		tempDirs.push(result.backupPath);

		expect(result.removed).toBe(3);
		expect(await Bun.file(join(global, "delete-everywhere", "SKILL.md")).exists()).toBe(false);
		expect(
			await Bun.file(join(firstProject, ".agents/skills/delete-everywhere/SKILL.md")).exists(),
		).toBe(false);
		expect(
			await Bun.file(join(secondProject, ".codex/skills/delete-everywhere/SKILL.md")).exists(),
		).toBe(false);
		expect(await Bun.file(join(result.backupPath, "manifest.json")).exists()).toBe(true);
		expect(await readdir(join(result.backupPath, "sources"))).toHaveLength(3);
		const manifest = JSON.parse(await readFile(join(result.backupPath, "manifest.json"), "utf8"));
		expect(manifest.settings).toMatchObject({
			slug: "delete-everywhere",
			label: "Skill descartável",
			icon: "Trash2",
			color: "#123456",
			quick_invoke: 1,
		});
	});
});

afterEach(async () => {
	await db.deleteFrom("skill_source_paths").execute();
	await db.deleteFrom("skill_settings").execute();
	const ownedProjectIds = projectIds.splice(0);
	if (ownedProjectIds.length > 0) {
		await db.deleteFrom("projects").where("id", "in", ownedProjectIds).execute();
	}
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

	test("deduplica roots por identidade canônica e rejeita SKILL.md symlink antes da leitura", async () => {
		const parent = await homeDir();
		const real = join(parent, "real");
		const alias = join(parent, "alias");
		await mkdir(real);
		await writeSkill(real, "canonical-root", "descrição", "corpo");
		await symlink(real, alias);
		await addRow("agents", real, "global", 1);
		await addRow("opencode", alias, "custom", 2);

		const found = (await listSkillsFromFs()).find((record) => record.slug === "canonical-root");
		expect(found?.sources).toHaveLength(1);

		const unsafe = join(real, "unsafe");
		await mkdir(unsafe);
		await symlink(join(real, "canonical-root", "SKILL.md"), join(unsafe, "SKILL.md"));
		let error: Error | null = null;
		try {
			await listSkillsFromFs();
		} catch (err: any) {
			error = err;
		}
		expect(error?.message).toContain("Link interno não suportado");
	});
});

describe("updateSkillInFs", () => {
	test("grava somente as variantes global, custom e de projeto escolhidas", async () => {
		const global = await homeDir();
		const custom = await homeDir();
		const project = await homeDir();
		await writeSkill(global, "editable", "global", "global");
		await writeSkill(custom, "editable", "custom", "custom");
		await writeSkill(join(project, ".agents/skills"), "editable", "projeto", "projeto");
		await addRow("agents", global, "global", 1);
		await addRow("opencode", custom, "custom", 2);
		const projectId = crypto.randomUUID();
		projectIds.push(projectId);
		await db
			.insertInto("projects")
			.values({
				id: projectId,
				name: "Projeto",
				color: "#000000",
				display_order: 0,
				main_route: project,
				hide_terminal: 0,
				task_layout_version: 1,
				created_at: Date.now(),
			})
			.execute();

		for (const marker of ["global", "custom", "projeto"]) {
			const skill = await getSkillFromFs("editable", "Projeto");
			const variant = skill?.variants.find((candidate) => candidate.description === marker);
			if (!variant) {
				throw new Error(`Variante ${marker} não encontrada`);
			}

			await updateSkillInFs({
				slug: "editable",
				projectName: "Projeto",
				variantPath: variant.path,
				description: `editada ${marker}`,
				content: `conteúdo ${marker}`,
				metadata: {},
				expectedSkillHash: variant.skillHash,
			});
		}

		expect(await readFile(join(global, "editable", "SKILL.md"), "utf8")).toContain(
			"conteúdo global",
		);
		expect(await readFile(join(custom, "editable", "SKILL.md"), "utf8")).toContain(
			"conteúdo custom",
		);
		expect(await readFile(join(project, ".agents/skills/editable/SKILL.md"), "utf8")).toContain(
			"conteúdo projeto",
		);
	});

	test("preserva name e tipos YAML e recusa destino ou hash inválido", async () => {
		const root = await homeDir();
		await mkdir(join(root, "typed"), { recursive: true });
		await writeFile(
			join(root, "typed", "SKILL.md"),
			"---\nname: nome-preservado\ndescription: antes\n---\n\ncorpo\n",
		);
		await writeSkill(root, "other", "outra", "outra");
		await addRow("agents", root, "global", 1);
		const skill = await getSkillFromFs("typed");
		const variant = skill?.variants[0];
		if (!variant) {
			throw new Error("Variante não encontrada");
		}
		const metadata = {
			name: "tentativa-de-troca",
			booleano: true,
			numero: 12,
			lista: ["a", 2],
			objeto: { ativo: false },
			nulo: null,
			desconhecida: "valor",
		};

		const updated = await updateSkillInFs({
			slug: "typed",
			variantPath: variant.path,
			description: "depois",
			content: "novo corpo",
			metadata,
			expectedSkillHash: variant.skillHash,
		});
		const reread = await getSkillFromFs("typed");
		const rereadVariant = reread?.variants.at(0);
		if (!rereadVariant) {
			throw new Error("Variante atualizada não encontrada");
		}

		expect(rereadVariant.metadata).toEqual({
			booleano: true,
			numero: 12,
			lista: ["a", 2],
			objeto: { ativo: false },
			nulo: null,
			desconhecida: "valor",
		});
		expect(await readFile(variant.path, "utf8")).toContain("name: nome-preservado");
		expect(updated.skillHash).toBe(rereadVariant.skillHash);

		for (const invalid of [join(root, "inventado", "SKILL.md"), join(root, "other", "SKILL.md")]) {
			let error: Error | null = null;
			try {
				await updateSkillInFs({
					slug: "typed",
					variantPath: invalid,
					description: "falha",
					content: "falha",
					metadata: {},
					expectedSkillHash: updated.skillHash,
				});
			} catch (err: any) {
				error = err;
			}
			expect(error?.message).toContain("não encontrada");
		}

		let staleError: Error | null = null;
		try {
			await updateSkillInFs({
				slug: "typed",
				variantPath: variant.path,
				description: "falha",
				content: "falha",
				metadata: {},
				expectedSkillHash: variant.skillHash,
			});
		} catch (err: any) {
			staleError = err;
		}
		expect(staleError?.message).toContain("mudou desde a última leitura");
		expect(
			skillContentHash({
				frontmatter: { name: "um", description: "igual" },
				body: "igual",
			}),
		).not.toBe(
			skillContentHash({
				frontmatter: { name: "dois", description: "igual" },
				body: "igual",
			}),
		);
	});
});

describe("renameSkillInFs", () => {
	test("migra as configurações que definem a invocação e a aparência", async () => {
		await dbSkillSettings.upsert({
			slug: "old-settings",
			label: "Nome visual",
			icon: "Sparkles",
			color: "#123456",
			quickInvoke: true,
		});

		await dbSkillSettings.rename("old-settings", "new-settings");
		const settings = await dbSkillSettings.getAll();

		expect(settings).toHaveLength(1);
		expect(settings[0]?.slug).toBe("new-settings");
		expect(settings[0]?.label).toBe("Nome visual");
		expect(settings[0]?.icon).toBe("Sparkles");
		expect(settings[0]?.color).toBe("#123456");
		expect(settings[0]?.quick_invoke).toBe(1);
	});

	test("renomeia todas as variantes, o frontmatter e preserva os arquivos", async () => {
		const first = await homeDir();
		const second = await homeDir();
		await writeSkill(first, "old-skill", "primeira", "corpo um");
		await writeSkill(second, "old-skill", "segunda", "corpo dois");
		await writeFile(join(first, "old-skill", "asset.txt"), "asset");
		await addRow("agents", first, "global", 1);
		await addRow("codex", second, "global", 2);
		const skill = await getSkillFromFs("old-skill");
		if (!skill) {
			throw new Error("Skill não encontrada");
		}

		const renamed = await renameSkillInFs({
			slug: "old-skill",
			newSlug: "new-skill",
			expectedVariants: skill.variants.map((variant) => ({
				path: variant.path,
				contentHash: variant.contentHash,
			})),
		});

		expect(renamed?.slug).toBe("new-skill");
		expect(renamed?.variants).toHaveLength(2);
		expect(await Bun.file(join(first, "old-skill", "SKILL.md")).exists()).toBe(false);
		expect(await Bun.file(join(second, "old-skill", "SKILL.md")).exists()).toBe(false);
		expect(await readFile(join(first, "new-skill", "SKILL.md"), "utf8")).toContain(
			"name: new-skill",
		);
		expect(await readFile(join(second, "new-skill", "SKILL.md"), "utf8")).toContain(
			"name: new-skill",
		);
		expect(await readFile(join(first, "new-skill", "asset.txt"), "utf8")).toBe("asset");
	});

	test("recusa estado obsoleto e destino existente antes de mover", async () => {
		const root = await homeDir();
		await writeSkill(root, "source-skill", "fonte", "fonte");
		await writeSkill(root, "taken-skill", "destino", "destino");
		await addRow("agents", root, "global", 1);
		const skill = await getSkillFromFs("source-skill");
		const variant = skill?.variants.at(0);
		if (!variant) {
			throw new Error("Variante não encontrada");
		}

		for (const input of [
			{
				slug: "source-skill",
				newSlug: "fresh-skill",
				expectedVariants: [{ path: variant.path, contentHash: "obsoleto" }],
			},
			{
				slug: "source-skill",
				newSlug: "taken-skill",
				expectedVariants: [{ path: variant.path, contentHash: variant.contentHash }],
			},
		]) {
			let error: Error | null = null;
			try {
				await renameSkillInFs(input);
			} catch (err: any) {
				error = err;
			}
			expect(error).not.toBeNull();
			expect(await Bun.file(join(root, "source-skill", "SKILL.md")).exists()).toBe(true);
		}
	});
});

describe("standardizeSkillInFs", () => {
	test("detecta conflito de assets, remove sobras e recusa plano obsoleto", async () => {
		const source = await homeDir();
		const target = await homeDir();
		await writeSkill(source, "bundle", "igual", "igual");
		await writeSkill(target, "bundle", "igual", "igual");
		await writeFile(join(source, "bundle", "asset.bin"), new Uint8Array([0, 1, 255]));
		await writeFile(join(target, "bundle", "sobra.txt"), "remover");
		await addRow("agents", source, "global", 1);
		await addRow("opencode", target, "global", 2);
		const skill = await getSkillFromFs("bundle");
		const chosen = skill?.variants[0];
		if (!skill || !chosen) {
			throw new Error("Skill não encontrada");
		}

		expect(skill.conflict).toBe(true);
		expect(chosen.files.map((file) => file.path)).toEqual(["SKILL.md", "asset.bin"]);
		const preview = await previewSkillStandardizationInFs({
			slug: "bundle",
			variantPath: chosen.path,
		});
		expect(preview.removedFiles).toBe(1);
		await writeFile(join(source, "bundle", "novo.txt"), "mudou");

		let staleError: Error | null = null;
		try {
			await standardizeSkillInFs({
				slug: "bundle",
				variantPath: chosen.path,
				planHash: preview.planHash,
			});
		} catch (err: any) {
			staleError = err;
		}
		expect(staleError?.message).toContain("mudaram desde a análise");
		expect((staleError as Error & { code?: string })?.code).toBe("CONFLICT");

		const current = await previewSkillStandardizationInFs({
			slug: "bundle",
			variantPath: chosen.path,
		});
		const result = await standardizeSkillInFs({
			slug: "bundle",
			variantPath: chosen.path,
			planHash: current.planHash,
		});
		expect(result.updated).toBe(1);
		expect(await Bun.file(join(target, "bundle", "sobra.txt")).exists()).toBe(false);
		expect(new Uint8Array(await readFile(join(target, "bundle", "asset.bin")))).toEqual(
			new Uint8Array([0, 1, 255]),
		);
	});
});
