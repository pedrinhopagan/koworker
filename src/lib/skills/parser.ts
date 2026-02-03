import { parse, stringify } from "yaml";

export interface SkillMetadata {
	name: string;
	description: string;
	license?: string;
	compatibility?: string;
	metadata?: Record<string, unknown>;
	[key: string]: unknown;
}

export interface SkillFile {
	frontmatter: SkillMetadata;
	body: string;
}

export function parseSkillMd(content: string): SkillFile {
	const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
	const match = content.match(frontmatterRegex);

	if (!match) {
		throw new Error(
			"Formato inválido de SKILL.md: frontmatter YAML ausente ou inválido",
		);
	}

	const [, frontmatterYaml, body] = match;

	try {
		const frontmatter = parse(frontmatterYaml) as SkillMetadata;

		if (!frontmatter.name || !frontmatter.description) {
			throw new Error(
				"Frontmatter inválido: 'name' e 'description' são obrigatórios",
			);
		}

		return {
			frontmatter,
			body: body.trim(),
		};
	} catch (error) {
		throw new Error(
			`Falha ao interpretar frontmatter YAML: ${error instanceof Error ? error.message : String(error)}`,
			{ cause: error },
		);
	}
}

export function serializeSkillMd(skill: SkillFile): string {
	const frontmatterYaml = stringify(skill.frontmatter, {
		lineWidth: 0,
	});

	return `---\n${frontmatterYaml.trim()}\n---\n\n${skill.body.trim()}\n`;
}

export async function readSkillFile(
	filePath: string,
): Promise<SkillFile | null> {
	try {
		const file = Bun.file(filePath);
		const content = await file.text();
		return parseSkillMd(content);
	} catch (error) {
		console.error(`Falha ao ler arquivo de skill ${filePath}:`, error);
		return null;
	}
}

export async function writeSkillFile(
	filePath: string,
	skill: SkillFile,
): Promise<boolean> {
	try {
		const content = serializeSkillMd(skill);
		await Bun.write(filePath, content);
		return true;
	} catch (error) {
		console.error(`Falha ao escrever arquivo de skill ${filePath}:`, error);
		return false;
	}
}
