/**
 * Example usage of the skill parser/serializer
 * This demonstrates the complete workflow for working with SKILL.md files
 */

import { readSkillFile, writeSkillFile, type SkillFile } from "./parser";
import { join } from "node:path";
import { homedir } from "node:os";

const SKILLS_DIR = join(homedir(), ".config/opencode/skills");

/**
 * Example: Read an existing koworker skill
 */
export async function readKoworkerSkill(skillName: string): Promise<SkillFile | null> {
	const skillPath = join(SKILLS_DIR, skillName, "SKILL.md");
	return await readSkillFile(skillPath);
}

/**
 * Example: Create a new skill
 */
export async function createNewSkill(
	skillName: string,
	description: string,
	body: string,
): Promise<boolean> {
	const skillPath = join(SKILLS_DIR, skillName, "SKILL.md");

	const newSkill: SkillFile = {
		frontmatter: {
			name: skillName,
			description,
			license: "MIT",
			compatibility: "opencode",
		},
		body,
	};

	return await writeSkillFile(skillPath, newSkill);
}

/**
 * Example: Update an existing skill
 */
export async function updateSkillDescription(
	skillName: string,
	newDescription: string,
): Promise<boolean> {
	const skillPath = join(SKILLS_DIR, skillName, "SKILL.md");

	const skill = await readSkillFile(skillPath);
	if (!skill) {
		console.error(`Skill ${skillName} not found`);
		return false;
	}

	skill.frontmatter.description = newDescription;

	return await writeSkillFile(skillPath, skill);
}

/**
 * Example: List all skills in the config directory
 */
export async function listAllSkills(): Promise<string[]> {
	const { readdir } = await import("node:fs/promises");

	try {
		const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
		return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
	} catch (error) {
		console.error("Failed to list skills:", error);
		return [];
	}
}

// Demonstração de uso
if (import.meta.main) {
	console.log("=== Skill Parser Usage Examples ===\n");

	// Exemplo 1: Ler skill existente
	console.log("1. Reading koworker-structure skill...");
	const skill = await readKoworkerSkill("koworker-structure");
	if (skill) {
		console.log(`   Name: ${skill.frontmatter.name}`);
		console.log(`   Description: ${skill.frontmatter.description}`);
		console.log(`   Body length: ${skill.body.length} chars`);
	}

	// Exemplo 2: Listar todas as skills
	console.log("\n2. Listing all skills...");
	const skills = await listAllSkills();
	console.log(`   Found ${skills.length} skills:`, skills);

	console.log("\n✓ Examples completed successfully");
}
