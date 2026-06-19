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

// Extrai o frontmatter de forma leniente: retorna null quando não há bloco `---...---` no início
// (paste normal segue intacto) e, quando há, faz parse com YAML caindo no loose no catch — sem
// exigir name/description. É a lógica de partição usada tanto pelo parser estrito quanto pela
// detecção de paste no editor.
export function extractFrontmatter(
	content: string,
): { frontmatter: Record<string, unknown>; body: string } | null {
	const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
	if (!match) return null;

	const [, frontmatterYaml, body] = match;

	let frontmatter: Record<string, unknown>;
	try {
		frontmatter = parse(frontmatterYaml);
	} catch {
		frontmatter = parseFrontmatterLoose(frontmatterYaml);
	}

	return { frontmatter, body: body.trim() };
}

export function parseSkillMd(content: string): SkillFile {
	const extracted = extractFrontmatter(content);

	if (!extracted) {
		throw new Error("Formato inválido de SKILL.md: frontmatter YAML ausente ou inválido");
	}

	const frontmatter = extracted.frontmatter as SkillMetadata;
	if (!frontmatter?.name || !frontmatter?.description) {
		throw new Error("Frontmatter inválido: 'name' e 'description' são obrigatórios");
	}

	return {
		frontmatter,
		body: extracted.body,
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
	} catch (error: any) {
		// Arquivo ausente é fluxo normal: o resolvedor sonda todos os roots conhecidos por slug e a
		// maioria não tem a skill. Só erro real (parse, permissão) merece log — ENOENT é silencioso.
		if (error?.code !== "ENOENT") {
			console.error(`Falha ao ler arquivo de skill ${filePath}:`, error);
		}
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
