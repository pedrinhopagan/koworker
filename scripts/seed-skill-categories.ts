import { dbSkillCategories } from "../src/api/db/skill-categories";
import { dbSkillSettings } from "../src/api/db/skill-settings";

// description é apenas referência humana da fase de análise — não há coluna pra ela,
// então só name/color vão pro banco.
const CATEGORIES = [
	{
		key: "revisao-codigo",
		name: "Revisão de Código",
		color: "#8c4a4a",
		description:
			"Revisão, verificação e auditoria de mudanças: bugs de correção, segurança e simplificação do diff.",
	},
	{
		key: "git",
		name: "Git",
		color: "#6b5b95",
		description: "Operações de versionamento, principalmente commits.",
	},
	{
		key: "frontend",
		name: "Frontend",
		color: "#3f7d8c",
		description: "Construção de UI: componentes React, estilização Tailwind e design de interface.",
	},
	{
		key: "backend-dados",
		name: "Backend e Dados",
		color: "#4a7c59",
		description: "Camada de servidor e dados: queries Kysely e APIs ORPC.",
	},
	{
		key: "config-docs",
		name: "Configuração e CLAUDE.md",
		color: "#8a7140",
		description:
			"Configuração da ferramenta e manutenção de CLAUDE.md: settings, keybindings, permissões e documentação de projeto.",
	},
	{
		key: "automacao",
		name: "Automação e Agendamento",
		color: "#7a5a3a",
		description: "Loops recorrentes, execução agendada e o plugin Ralph Loop.",
	},
	{
		key: "koworker",
		name: "Fluxo Koworker",
		color: "#3d6a8a",
		description:
			"Skills do fluxo de trabalho koworker: estrutura, execução e revisão de subtarefas.",
	},
	{
		key: "produtividade",
		name: "Produtividade e Meta",
		color: "#5f5f5f",
		description:
			"Skills transversais e meta: comunicação, handoff, prototipação, pesquisa, criação de skills e referência da API Claude.",
	},
];

const ASSIGNMENTS = [
	{ slug: "code-review", categoryKey: "revisao-codigo" },
	{ slug: "security-review", categoryKey: "revisao-codigo" },
	{ slug: "review", categoryKey: "revisao-codigo" },
	{ slug: "simplify", categoryKey: "revisao-codigo" },
	{ slug: "verify", categoryKey: "revisao-codigo" },
	{ slug: "commit", categoryKey: "git" },
	{ slug: "koworker-commit", categoryKey: "git" },
	{ slug: "react-components", categoryKey: "frontend" },
	{ slug: "tailwind", categoryKey: "frontend" },
	{ slug: "frontend-design", categoryKey: "frontend" },
	{ slug: "kysely", categoryKey: "backend-dados" },
	{ slug: "orpc", categoryKey: "backend-dados" },
	{ slug: "init", categoryKey: "config-docs" },
	{ slug: "revise-claude-md", categoryKey: "config-docs" },
	{ slug: "claude-md-improver", categoryKey: "config-docs" },
	{ slug: "update-config", categoryKey: "config-docs" },
	{ slug: "keybindings-help", categoryKey: "config-docs" },
	{ slug: "fewer-permission-prompts", categoryKey: "config-docs" },
	{ slug: "ralph-loop", categoryKey: "automacao" },
	{ slug: "cancel-ralph", categoryKey: "automacao" },
	{ slug: "help", categoryKey: "automacao" },
	{ slug: "loop", categoryKey: "automacao" },
	{ slug: "schedule", categoryKey: "automacao" },
	{ slug: "run", categoryKey: "automacao" },
	{ slug: "koworker-structure", categoryKey: "koworker" },
	{ slug: "koworker-review-execution", categoryKey: "koworker" },
	{ slug: "koworker-review-structure", categoryKey: "koworker" },
	{ slug: "koworker-loop", categoryKey: "koworker" },
	{ slug: "koworker-execute-subtask", categoryKey: "koworker" },
	{ slug: "koworker-execute-all", categoryKey: "koworker" },
	{ slug: "caveman", categoryKey: "produtividade" },
	{ slug: "handoff", categoryKey: "produtividade" },
	{ slug: "prototype", categoryKey: "produtividade" },
	{ slug: "deep-research", categoryKey: "produtividade" },
	{ slug: "skill-creator", categoryKey: "produtividade" },
	{ slug: "claude-api", categoryKey: "produtividade" },
];

const categoryIdByKey = new Map<string, string>();
let created = 0;
let reused = 0;

for (const category of CATEGORIES) {
	const existing = await dbSkillCategories.findByNormalizedName(category.name);

	if (existing) {
		categoryIdByKey.set(category.key, existing.id);
		reused++;
		continue;
	}

	const id = crypto.randomUUID();
	await dbSkillCategories.create({ id, name: category.name, color: category.color });
	categoryIdByKey.set(category.key, id);
	created++;
}

let assigned = 0;
let skipped = 0;

for (const assignment of ASSIGNMENTS) {
	const categoryId = categoryIdByKey.get(assignment.categoryKey);

	if (!categoryId) {
		skipped++;
		continue;
	}

	await dbSkillSettings.upsert({ slug: assignment.slug, categoryId });
	assigned++;
}

console.log(
	`Categorias: ${created} criadas, ${reused} reaproveitadas. Skills atribuídas: ${assigned}${skipped > 0 ? ` (${skipped} puladas sem categoria)` : ""}.`,
);
