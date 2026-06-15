import { dbSkillCategories } from "../src/api/db/skill-categories";
import { dbSkillSettings } from "../src/api/db/skill-settings";

// Categorias das skills globais reais (a cor de cada skill espelha a cor da categoria).
const CATEGORIES = [
	{ key: "planejamento", name: "Planejamento e PRD", color: "#f59e0b" },
	{ key: "git", name: "Git e Entrega", color: "#3584e4" },
	{ key: "pesquisa", name: "Pesquisa e Entendimento", color: "#26a269" },
	{ key: "arquitetura", name: "Arquitetura e Código", color: "#e66100" },
	{ key: "integracoes", name: "Testes e Integrações", color: "#813d9c" },
	{ key: "koworker", name: "Fluxo Koworker e Meta", color: "#1c71d8" },
];

const COLOR_BY_CATEGORY = new Map(CATEGORIES.map((category) => [category.key, category.color]));

// slug → categoria + ícone (lucide). A cor é derivada da categoria, não repetida aqui.
const ASSIGNMENTS = [
	{ slug: "prd-to-plan", categoryKey: "planejamento", icon: "ListChecks" },
	{ slug: "to-plan", categoryKey: "planejamento", icon: "ListTree" },
	{ slug: "to-prd", categoryKey: "planejamento", icon: "FileText" },
	{ slug: "write-a-prd", categoryKey: "planejamento", icon: "ScrollText" },
	{ slug: "write-a-prd-to-ralph", categoryKey: "planejamento", icon: "FileCog" },
	{ slug: "commit", categoryKey: "git", icon: "GitCommitHorizontal" },
	{ slug: "pr", categoryKey: "git", icon: "GitPullRequest" },
	{ slug: "worktree", categoryKey: "git", icon: "GitBranch" },
	{ slug: "explain", categoryKey: "pesquisa", icon: "Lightbulb" },
	{ slug: "grill-me", categoryKey: "pesquisa", icon: "MessageCircleQuestionMark" },
	{ slug: "grill-with-docs", categoryKey: "pesquisa", icon: "FileQuestionMark" },
	{ slug: "zoom-out", categoryKey: "pesquisa", icon: "Telescope" },
	{ slug: "teach", categoryKey: "pesquisa", icon: "GraduationCap" },
	{ slug: "for-interview", categoryKey: "pesquisa", icon: "Briefcase" },
	{ slug: "improve-codebase-architecture", categoryKey: "arquitetura", icon: "Layers" },
	{ slug: "prototype", categoryKey: "arquitetura", icon: "FlaskConical" },
	{ slug: "agent-browser", categoryKey: "integracoes", icon: "AppWindow" },
	{ slug: "dogama-login", categoryKey: "integracoes", icon: "KeyRound" },
	{ slug: "obsidian-vault", categoryKey: "integracoes", icon: "NotebookPen" },
	{ slug: "what-if", categoryKey: "integracoes", icon: "Workflow" },
	{ slug: "koworker", categoryKey: "koworker", icon: "FolderTree" },
	{ slug: "kw", categoryKey: "koworker", icon: "PencilRuler" },
	{ slug: "skill-principles", categoryKey: "koworker", icon: "Sparkles" },
	{ slug: "handoff", categoryKey: "koworker", icon: "Feather" },
	{ slug: "caveman", categoryKey: "koworker", icon: "Minimize2" },
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

for (const assignment of ASSIGNMENTS) {
	const categoryId = categoryIdByKey.get(assignment.categoryKey);
	const color = COLOR_BY_CATEGORY.get(assignment.categoryKey);
	if (!categoryId || !color) {
		throw new Error(`Categoria desconhecida para ${assignment.slug}: ${assignment.categoryKey}`);
	}

	await dbSkillSettings.upsert({
		slug: assignment.slug,
		categoryId,
		icon: assignment.icon,
		color,
	});
	assigned++;
}

console.log(
	`Categorias: ${created} criadas, ${reused} reaproveitadas. Skills atribuídas: ${assigned}.`,
);
