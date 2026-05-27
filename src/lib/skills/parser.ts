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

// Skills reais (Claude Code, opencode) frequentemente têm descrições com ": "
// não escapado, que o parser YAML estrito rejeita. Esses loaders tratam cada
// campo de topo como "chave: resto da linha como string", então caímos nisso
// quando o YAML falha para nunca esconder uma skill por causa do frontmatter.
function parseFrontmatterLoose(yamlText: string): SkillMetadata {
	const frontmatter: Record<string, unknown> = {};

	for (const line of yamlText.split("\n")) {
		const match = line.match(/^([A-Za-z0-9_-]+):\s?(.*)$/);
		if (!match) continue;

		const [, key, rawValue] = match;
		let value = rawValue.trim();
		const quoted =
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"));
		if (quoted) value = value.slice(1, -1);

		frontmatter[key] = value;
	}

	return frontmatter as SkillMetadata;
}

export function parseSkillMd(content: string): SkillFile {
	const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
	const match = content.match(frontmatterRegex);

	if (!match) {
		throw new Error("Formato inválido de SKILL.md: frontmatter YAML ausente ou inválido");
	}

	const [, frontmatterYaml, body] = match;

	let frontmatter: SkillMetadata;
	try {
		frontmatter = parse(frontmatterYaml) as SkillMetadata;
	} catch {
		frontmatter = parseFrontmatterLoose(frontmatterYaml);
	}

	if (!frontmatter?.name || !frontmatter?.description) {
		throw new Error("Frontmatter inválido: 'name' e 'description' são obrigatórios");
	}

	return {
		frontmatter,
		body: body.trim(),
	};
}

export function serializeSkillMd(skill: SkillFile): string {
	const frontmatterYaml = stringify(skill.frontmatter, {
		lineWidth: 0,
	});

	return `---\n${frontmatterYaml.trim()}\n---\n\n${skill.body.trim()}\n`;
}

export async function readSkillFile(filePath: string): Promise<SkillFile | null> {
	try {
		const file = Bun.file(filePath);
		const content = await file.text();
		return parseSkillMd(content);
	} catch (error) {
		console.error(`Falha ao ler arquivo de skill ${filePath}:`, error);
		return null;
	}
}

export async function writeSkillFile(filePath: string, skill: SkillFile): Promise<boolean> {
	try {
		const content = serializeSkillMd(skill);
		await Bun.write(filePath, content);
		return true;
	} catch (error) {
		console.error(`Falha ao escrever arquivo de skill ${filePath}:`, error);
		return false;
	}
}
