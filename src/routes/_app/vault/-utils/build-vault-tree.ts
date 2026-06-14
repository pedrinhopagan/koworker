import type { RouterOutputs } from "@/client";
import type { TaskSkill } from "@/types/skills";

type VaultListOutput = RouterOutputs["vault"]["listEntries"];
export type VaultEntry = VaultListOutput["entries"][number];
type VaultGroup = VaultListOutput["groups"][number];
type Priority = RouterOutputs["priorities"]["list"][number];
type Category = RouterOutputs["categories"]["list"][number];

// Ordenação das pastas de tarefa (controle inline na linha "Tarefas"). Clusteriza sem sub-headers.
export type TaskSortMode = "recente" | "prioridade" | "categoria";

const DEFAULT_PRIORITY_COLOR = "#666";
// Gradiente "mais recente": topo (index 0) na cor cheia do projeto, esmaecendo até a 10ª tarefa.
const RECENT_GRADIENT_SPAN = 10;
const RECENT_MIN_ALPHA = 0.25;

function withAlpha(hex: string, alpha: number): string {
	if (!(hex.startsWith("#") && hex.length === 7)) return hex;
	const clamped = Math.max(0, Math.min(1, alpha));
	const byte = Math.round(clamped * 255)
		.toString(16)
		.padStart(2, "0");
	return `${hex}${byte}`;
}

function recentAlpha(index: number): number {
	const t = Math.min(index, RECENT_GRADIENT_SPAN) / RECENT_GRADIENT_SPAN;
	return 1 - (1 - RECENT_MIN_ALPHA) * t;
}

// Nó da árvore do vault. A união discriminada por `kind` carrega tudo que o renderer precisa pra
// decidir ícone, destino do clique e ações — sem voltar às queries. Pastas têm `children`; folhas
// não. `feature` é virtual (Tarefas/Skills/Agents), sem dado de disco.
export type TreeNode =
	| { kind: "feature"; key: string; label: string; children: TreeNode[]; placeholder?: string }
	| {
			kind: "taskFolder";
			key: string;
			label: string;
			taskId: string;
			color: string;
			done: boolean;
			priorityId: string | null;
			priorityName: string | null;
			priorityColor: string | null;
			categoryId: string | null;
			categoryName: string | null;
			categoryColor: string | null;
			lastEditedAt: number;
			children: TreeNode[];
	  }
	| { kind: "looseFolder"; key: string; label: string; folderName: string; children: TreeNode[] }
	| {
			kind: "skillFolder";
			key: string;
			label: string;
			slug: string;
			icon: string;
			color: string;
			description: string;
			source: "builtin" | "custom";
			sourceCount: number;
			conflict: boolean;
			children: TreeNode[];
	  }
	| { kind: "fileLeaf"; key: string; label: string; title: string; entry: VaultEntry }
	| { kind: "skillSourceLeaf"; key: string; label: string; slug: string };

export type FileLeaf = Extract<TreeNode, { kind: "fileLeaf" }>;
export type TaskFolder = Extract<TreeNode, { kind: "taskFolder" }>;
export type SkillFolder = Extract<TreeNode, { kind: "skillFolder" }>;

export const ROOT_KEY = ".koworker";
export const TAREFAS_KEY = "feature:tarefas";
export const SKILLS_KEY = "feature:skills";
export const AGENTS_KEY = "feature:agents";

// Chaves de expansão default com prefixo — em "Todos" cada projeto vira uma subárvore namespaceada.
// Sem prefixo, abre workspace e Tarefas (Skills/Agents nascem fechadas).
export function defaultExpandedKeys(keyPrefix = ""): string[] {
	return [`${keyPrefix}${ROOT_KEY}`, `${keyPrefix}${TAREFAS_KEY}`];
}

// Chaves abertas por default no modo single: workspace e Tarefas.
export const DEFAULT_EXPANDED = new Set(defaultExpandedKeys());

function fileLeaf(entry: VaultEntry, keyPrefix: string): TreeNode {
	return {
		kind: "fileLeaf",
		key: `${keyPrefix}file:${entry.origin}:${entry.groupKey ?? ""}:${entry.name}`,
		label: entry.name,
		title: entry.title,
		entry,
	};
}

// Arquivos de um grupo, mais recente primeiro — espelha a ordem da visão antiga.
function filesOf(entries: VaultEntry[], groupKey: string, keyPrefix: string): TreeNode[] {
	return entries
		.filter((entry) => entry.groupKey === groupKey)
		.sort((a, b) => b.mtime - a.mtime)
		.map((entry) => fileLeaf(entry, keyPrefix));
}

// `keyPrefix` namespaceia as chaves dos nós montados aqui (não os dados crus: entry/taskId/
// folderName seguem intactos pra navegação/mutations/drop). Omitido → chaves idênticas às de hoje,
// então o modo single-project não regride. `includeSkillsAgents` false omite os nós Skills/Agents
// (em "Todos" skills são por nome de projeto, fora do escopo).
export function buildVaultTree({
	entries,
	groups,
	skills,
	priorities,
	categories,
	projectColor,
	hideCompleted,
	taskSort,
	keyPrefix = "",
	includeSkillsAgents = true,
}: {
	entries: VaultEntry[];
	groups: VaultGroup[];
	skills: TaskSkill[];
	priorities: Priority[];
	categories: Category[];
	projectColor: string | null;
	hideCompleted: boolean;
	taskSort: TaskSortMode;
	keyPrefix?: string;
	includeSkillsAgents?: boolean;
}): TreeNode[] {
	const priorityColor = new Map(priorities.map((priority) => [priority.id, priority.color]));
	const priorityName = new Map(priorities.map((priority) => [priority.id, priority.name]));
	const priorityLevel = new Map(priorities.map((priority) => [priority.id, priority.level]));
	const categoryColor = new Map(categories.map((category) => [category.id, category.color]));
	const categoryName = new Map(categories.map((category) => [category.id, category.name]));
	const categoryOrder = new Map(categories.map((category) => [category.id, category.displayOrder]));

	// Cor da pasta de tarefa segue o modo: categoria = cor da categoria; recente = gradiente da cor
	// do projeto pelo rank (topo mais vivo); demais (prioridade/default) = cor da prioridade.
	function folderColor(group: VaultGroup, index: number): string {
		if (taskSort === "categoria") {
			return (
				(group.categoryId ? categoryColor.get(group.categoryId) : null) ?? DEFAULT_PRIORITY_COLOR
			);
		}
		if (taskSort === "recente" && projectColor) {
			return withAlpha(projectColor, recentAlpha(index));
		}
		return (
			(group.priorityId ? priorityColor.get(group.priorityId) : null) ?? DEFAULT_PRIORITY_COLOR
		);
	}

	// Recente = mtime desc (default). Prioridade = level asc (Alta primeiro). Categoria = displayOrder
	// asc. Sempre desempata por lastEditedAt desc — sem grupos-com-cabeçalho, só clusteriza a ordem.
	function rank(order: Map<string, number>, id: string | undefined): number {
		return id ? (order.get(id) ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
	}
	function compareTaskGroups(a: VaultGroup, b: VaultGroup): number {
		if (a.kind !== "task" || b.kind !== "task") return 0;
		if (taskSort === "prioridade") {
			const diff = rank(priorityLevel, a.priorityId) - rank(priorityLevel, b.priorityId);
			if (diff !== 0) return diff;
		}
		if (taskSort === "categoria") {
			const diff = rank(categoryOrder, a.categoryId) - rank(categoryOrder, b.categoryId);
			if (diff !== 0) return diff;
		}
		return b.lastEditedAt - a.lastEditedAt;
	}

	const taskFolders: TreeNode[] = groups
		.filter((group) => group.kind === "task" && !(hideCompleted && (group.done ?? false)))
		.sort(compareTaskGroups)
		.map((group, index) => ({
			kind: "taskFolder",
			key: `${keyPrefix}task:${group.key}`,
			label: group.title,
			taskId: group.key,
			color: folderColor(group, index),
			done: group.done ?? false,
			priorityId: group.priorityId ?? null,
			categoryId: group.categoryId ?? null,
			priorityName: (group.priorityId ? priorityName.get(group.priorityId) : null) ?? null,
			priorityColor: (group.priorityId ? priorityColor.get(group.priorityId) : null) ?? null,
			categoryName: (group.categoryId ? categoryName.get(group.categoryId) : null) ?? null,
			categoryColor: (group.categoryId ? categoryColor.get(group.categoryId) : null) ?? null,
			lastEditedAt: group.lastEditedAt,
			children: filesOf(entries, group.key, keyPrefix),
		}));

	const skillFolders: TreeNode[] = [...skills]
		.sort((a, b) => a.label.localeCompare(b.label))
		.map((skill) => ({
			kind: "skillFolder",
			key: `${keyPrefix}skill:${skill.slug}`,
			label: skill.label,
			slug: skill.slug,
			icon: skill.icon,
			color: skill.color,
			description: skill.description,
			source: skill.source,
			sourceCount: skill.sources.length,
			conflict: skill.conflict,
			children: skill.sources.map((source, index) => ({
				kind: "skillSourceLeaf",
				key: `${keyPrefix}skillsrc:${skill.slug}:${source.tool}:${source.scope}:${index}`,
				label: `${source.tool} · ${source.scope}`,
				slug: skill.slug,
			})),
		}));

	const looseFolders: TreeNode[] = groups
		.filter((group) => group.kind === "folder")
		.sort((a, b) => a.title.localeCompare(b.title))
		.map((group) => ({
			kind: "looseFolder",
			key: `${keyPrefix}folder:${group.key}`,
			label: group.title,
			folderName: group.key,
			children: filesOf(entries, group.key, keyPrefix),
		}));

	const looseFiles: TreeNode[] = entries
		.filter((entry) => entry.origin === "loose")
		.sort((a, b) => b.mtime - a.mtime)
		.map((entry) => fileLeaf(entry, keyPrefix));

	const skillsAgentsNodes: TreeNode[] = includeSkillsAgents
		? [
				{
					kind: "feature",
					key: `${keyPrefix}${SKILLS_KEY}`,
					label: "Skills",
					children: skillFolders,
				},
				{
					kind: "feature",
					key: `${keyPrefix}${AGENTS_KEY}`,
					label: "Agents",
					children: [],
					placeholder: "Em breve",
				},
			]
		: [];

	return [
		{
			kind: "feature",
			key: `${keyPrefix}${ROOT_KEY}`,
			label: ROOT_KEY,
			children: [
				{
					kind: "feature",
					key: `${keyPrefix}${TAREFAS_KEY}`,
					label: "Tarefas",
					children: taskFolders,
				},
				...skillsAgentsNodes,
				...looseFolders,
				...looseFiles,
			],
		},
	];
}

// Folhas de arquivo na ordem em que aparecem, considerando só as pastas expandidas — base do
// range com Shift (a seleção contígua segue a ordem visível).
export function flattenVisibleLeaves(nodes: TreeNode[], expanded: Set<string>): FileLeaf[] {
	const out: FileLeaf[] = [];
	for (const node of nodes) {
		if ("children" in node) {
			if (expanded.has(node.key)) {
				out.push(...flattenVisibleLeaves(node.children, expanded));
			}
		} else if (node.kind === "fileLeaf") {
			out.push(node);
		}
	}
	return out;
}

// Todas as folhas de arquivo da árvore (independente de expansão) — lookup nodeKey→entry pras
// mutations de lote, já que um nó selecionado pode estar sob uma pasta colapsada.
export function collectFileLeaves(nodes: TreeNode[]): FileLeaf[] {
	const out: FileLeaf[] = [];
	for (const node of nodes) {
		if ("children" in node) {
			out.push(...collectFileLeaves(node.children));
		} else if (node.kind === "fileLeaf") {
			out.push(node);
		}
	}
	return out;
}

// Pastas de tarefa da árvore — lookup nodeKey→taskId pro alvo do drop (evita parsear a chave).
export function collectTaskFolders(nodes: TreeNode[]): TaskFolder[] {
	const out: TaskFolder[] = [];
	for (const node of nodes) {
		if (node.kind === "taskFolder") {
			out.push(node);
		}
		if ("children" in node) {
			out.push(...collectTaskFolders(node.children));
		}
	}
	return out;
}

// Chaves de todas as pastas da árvore — alvo do "expandir tudo".
export function collectFolderKeys(nodes: TreeNode[]): string[] {
	const keys: string[] = [];
	for (const node of nodes) {
		if ("children" in node) {
			keys.push(node.key, ...collectFolderKeys(node.children));
		}
	}
	return keys;
}

function nodeText(node: TreeNode): string {
	return node.kind === "fileLeaf" ? `${node.label} ${node.title}` : node.label;
}

// Poda a árvore pelo termo de busca (nome/título), mantendo os ancestrais de cada acerto. As pastas
// que ganham acerto entram em `forcedOpen` pra serem abertas sem mexer no estado de expansão base.
// Pasta que casa só pelo próprio nome (sem filho casando) fica fechada, pro usuário expandir.
export function filterTree(
	nodes: TreeNode[],
	term: string,
): { nodes: TreeNode[]; forcedOpen: Set<string> } {
	const needle = term.trim().toLowerCase();
	const forcedOpen = new Set<string>();

	function prune(input: TreeNode[]): TreeNode[] {
		const out: TreeNode[] = [];
		for (const node of input) {
			const selfMatch = nodeText(node).toLowerCase().includes(needle);
			if ("children" in node) {
				const keptChildren = prune(node.children);
				if (keptChildren.length > 0) {
					forcedOpen.add(node.key);
					out.push({ ...node, children: keptChildren });
				} else if (selfMatch) {
					out.push(node);
				}
			} else if (selfMatch) {
				out.push(node);
			}
		}
		return out;
	}

	return { nodes: prune(nodes), forcedOpen };
}
