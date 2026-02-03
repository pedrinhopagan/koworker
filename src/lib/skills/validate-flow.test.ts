import { describe, expect, it } from "bun:test";
import { readSkillFile, writeSkillFile, type SkillFile } from "./parser";
import { join } from "node:path";
import { mkdir, rm } from "node:fs/promises";

const TEST_DIR = "/tmp/kowork-skill-test";
const TEST_SKILL_PATH = join(TEST_DIR, "test-skill", "SKILL.md");

describe("End-to-End Skill File Operations", () => {
	it("should create, read, update and delete SKILL.md files", async () => {
		// Setup: criar diretório de teste
		await mkdir(join(TEST_DIR, "test-skill"), { recursive: true });

		// CREATE: Escrever nova skill
		const newSkill: SkillFile = {
			frontmatter: {
				name: "test-e2e-skill",
				description: "End-to-end test skill",
				license: "MIT",
				compatibility: "opencode",
				metadata: {
					audience: "developers",
					workflow: "test",
				},
			},
			body: `## Test Skill

This is a test skill for end-to-end validation.

### Usage

1. Step one
2. Step two`,
		};

		const writeSuccess = await writeSkillFile(TEST_SKILL_PATH, newSkill);
		expect(writeSuccess).toBe(true);

		// READ: Ler skill criada
		const readSkill = await readSkillFile(TEST_SKILL_PATH);
		expect(readSkill).not.toBeNull();
		expect(readSkill?.frontmatter.name).toBe("test-e2e-skill");
		expect(readSkill?.frontmatter.description).toBe("End-to-end test skill");
		expect(readSkill?.body).toContain("## Test Skill");

		// UPDATE: Atualizar skill
		if (readSkill) {
			readSkill.frontmatter.description = "Updated description";
			readSkill.body = "## Updated Content\n\nThis is updated.";

			const updateSuccess = await writeSkillFile(TEST_SKILL_PATH, readSkill);
			expect(updateSuccess).toBe(true);

			// Verificar atualização
			const updatedSkill = await readSkillFile(TEST_SKILL_PATH);
			expect(updatedSkill?.frontmatter.description).toBe("Updated description");
			expect(updatedSkill?.body).toContain("Updated Content");
		}

		// Cleanup: Remover diretório de teste
		await rm(TEST_DIR, { recursive: true, force: true });
	});

	it("should read existing koworker skills from config", async () => {
		const skillPath =
			"/home/pedro/.config/opencode/skills/koworker-structure/SKILL.md";
		const skill = await readSkillFile(skillPath);

		expect(skill).not.toBeNull();
		expect(skill?.frontmatter.name).toBe("Estruturar");
		expect(skill?.frontmatter.description).toBeTruthy();
		expect(skill?.body).toBeTruthy();
	});
});
