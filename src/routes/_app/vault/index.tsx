import {
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	PointerSensor,
	pointerWithin,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	ChevronsDownUp,
	ChevronsUpDown,
	CircleCheck,
	Clock,
	Files,
	Flame,
	LayoutGrid,
	Library,
	Loader2,
	Plus,
	Search,
	Unlink,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { orpc } from "@/client";
import { PageShell } from "@/components/layout/page-shell";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { useSkillsQuery } from "@/hooks/use-skills";
import { copyMarkdown, joinPath, openFolderInOs, shareFolderAsZip } from "@/lib/os-share";
import { cn } from "@/lib/utils";
import { type ClickModifiers, Tree } from "./-components/tree";
import { TreeBatchMenu, type TreeActions, TreeNodeMenu } from "./-components/tree-node-menu";
import {
	buildVaultTree,
	collectFileLeaves,
	collectFolderKeys,
	collectTaskFolders,
	DEFAULT_EXPANDED,
	defaultExpandedKeys,
	filterTree,
	flattenVisibleLeaves,
	ROOT_KEY,
	TAREFAS_KEY,
	type TaskSortMode,
	type TreeNode,
	type VaultEntry,
} from "./-utils/build-vault-tree";

// Id do droppable da faixa "soltar no vault" (unlink). Único, fora do espaço de chaves da árvore.
const ROOT_DROP_ID = "root:loose";

type DragPayload = { entries: VaultEntry[]; origin: SelectionOrigin; folderName: string | null };

type SelectionOrigin = "loose" | "task" | "folder";
type Selection = { origin: SelectionOrigin; folderName: string | null; keys: Set<string> };

function emptySelection(): Selection {
	return { origin: "loose", folderName: null, keys: new Set() };
}

// Chaves abertas por default. Single = workspace + Tarefas. "Todos" = cada nó-projeto + a workspace
// e Tarefas namespaceadas de cada um (projetos vazios são podados da árvore, então abrir um nó vazio
// é inócuo — evita correr contra o carregamento da query).
function computeDefaultExpanded(allProjects: boolean, projects: { id: string }[]): Set<string> {
	if (!allProjects) return new Set(DEFAULT_EXPANDED);

	const keys = projects.flatMap((project) => [
		`project:${project.id}`,
		...defaultExpandedKeys(`project:${project.id}:`),
	]);
	return new Set(keys);
}

const searchSchema = z.object({
	searchQuery: z.string().optional(),
});

export const Route = createFileRoute("/_app/vault/")({
	validateSearch: (search) => searchSchema.parse(search),
	component: VaultPage,
});

// Entries dos arquivos `.md` diretos de uma pasta (looseFolder) — payload do movimento em lote.
function folderEntries(node: TreeNode): VaultEntry[] {
	if (!("children" in node)) return [];
	return node.children.flatMap((child) => (child.kind === "fileLeaf" ? [child.entry] : []));
}

function VaultPage() {
	const { projects, selectedProjectId, selectedProject, setSelectedProjectId } = useProjectFocus();
	const queryClient = useQueryClient();
	const navigate = Route.useNavigate();

	// Busca vive na URL (searchQuery) — compartilhável e persistente ao navegar/voltar.
	const { searchQuery } = Route.useSearch();
	const search = searchQuery ?? "";
	const setSearch = (value: string) => {
		navigate({
			search: (prev) => ({ ...prev, searchQuery: value.length > 0 ? value : undefined }),
			replace: true,
		});
	};

	// "Todos os projetos": sem projeto focado, a árvore agrupa por projeto e fica somente-leitura
	// (mutations/DnD/menu dependem de um projectId único). Abrir um arquivo foca o projeto (drill-in).
	const allProjects = selectedProjectId === undefined;

	// Pastas expandidas (inclui os nós virtuais). Sem persistência: reseta ao trocar de projeto.
	const [expanded, setExpanded] = useState<Set<string>>(() =>
		computeDefaultExpanded(allProjects, projects),
	);
	// Identidade estável da lista de projetos: o reset de expansão em "Todos" depende de quais
	// projetos existem, mas não deve disparar a cada refetch que devolve um array novo.
	const projectIdsKey = projects.map((project) => project.id).join(",");
	// Esconde tarefas concluídas por default — substitui o painel de 4 filtros da visão antiga.
	const [hideCompleted, setHideCompleted] = useState(true);
	// Ordenação das pastas de tarefa (controle inline na linha "Tarefas"). Local do vault — não
	// acopla ao `useSortMode` do /tarefas.
	const [taskSort, setTaskSort] = useState<TaskSortMode>("recente");

	// Diálogos de arquivo: criar nota solta (só título), renomear e deletar. Um por vez.
	const [creatingTitle, setCreatingTitle] = useState<string | null>(null);
	const [renaming, setRenaming] = useState<{ name: string; value: string } | null>(null);
	const [deleting, setDeleting] = useState<string | null>(null);
	// Diálogos da pasta de tarefa: renomear (título da tarefa) e excluir.
	const [renamingTask, setRenamingTask] = useState<{ id: string; value: string } | null>(null);
	const [deletingTask, setDeletingTask] = useState<{ id: string; title: string } | null>(null);

	// Multi-seleção origin-exclusiva: arquivos de uma única origem por vez (loose/task/folder), com
	// `folderName` fixo quando folder. `anchorKey` é a âncora do range com Shift. As ações de lote
	// vivem no menu de contexto de um nó selecionado.
	const [selection, setSelection] = useState<Selection>(emptySelection);
	const [anchorKey, setAnchorKey] = useState<string | null>(null);

	// Arraste em curso: arrastar um nó selecionado leva a seleção inteira; senão, só ele.
	const [drag, setDrag] = useState<DragPayload | null>(null);
	// `distance` evita que o arraste engula o clique (selecionar/abrir) das rows-botão.
	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

	function clearSelection() {
		setSelection(emptySelection());
		setAnchorKey(null);
	}

	// biome-ignore lint/correctness/useExhaustiveDependencies: projectIdsKey deriva de `projects`.
	useEffect(() => {
		setExpanded(computeDefaultExpanded(allProjects, projects));
		setHideCompleted(true);
		setTaskSort("recente");
		setCreatingTitle(null);
		setRenaming(null);
		setDeleting(null);
		setRenamingTask(null);
		setDeletingTask(null);
		setSelection(emptySelection());
		setAnchorKey(null);
		setDrag(null);
	}, [selectedProjectId, allProjects, projectIdsKey]);

	// projectId só é exigido pelas mutations (todas single-project, gated por !allProjects). A query
	// de entries aceita undefined ("Todos" = sem filtro, agrega todos no servidor).
	const projectId = selectedProjectId ?? "";

	// `null` = ainda resolvendo o projeto focado (load window); `undefined` = "Todos" (sem filtro);
	// string = projeto. Só `null` desabilita a query — passar `null` ao schema (.optional()) quebraria
	// e single-mode piscaria vazio no load.
	const entriesQuery = useQuery({
		...orpc.vault.listEntries.queryOptions({ input: { projectId: selectedProjectId } }),
		enabled: selectedProjectId !== null,
	});
	const prioritiesQuery = useQuery(orpc.priorities.list.queryOptions());
	const categoriesQuery = useQuery(orpc.categories.list.queryOptions());
	// Todas as tasks do projeto (inclusive vazias) — alvo dos pickers do menu de contexto. O
	// agregador do vault só traz grupos com arquivo, então uma task vazia não apareceria sem esta.
	// Só no modo single com projeto resolvido: em "Todos"/load o menu de contexto não aparece.
	const tasksQuery = useQuery({
		...orpc.tasks.listByProject.queryOptions({ input: { projectId } }),
		enabled: Boolean(selectedProjectId),
	});
	const { taskSkills } = useSkillsQuery(selectedProject?.name);

	const entries = entriesQuery.data?.entries ?? [];
	const groups = entriesQuery.data?.groups ?? [];

	// Chave do grupo (taskId ou nome da pasta solta) → folder_path relativo do backend. Fonte única
	// pra resolver o diretório absoluto de qualquer nó no SO (share/abrir), sem reconstruir o layout.
	const groupFolderPath = useMemo(
		() =>
			new Map(
				groups.flatMap((group) =>
					group.folderPath ? [[group.key, group.folderPath] as const] : [],
				),
			),
		[groups],
	);

	const looseNames = useMemo(
		() => new Set(entries.filter((entry) => entry.origin === "loose").map((entry) => entry.name)),
		[entries],
	);
	const taskOptions = useMemo(
		() => (tasksQuery.data ?? []).map((task) => ({ id: task.id, displayTitle: task.displayTitle })),
		[tasksQuery.data],
	);

	// Dados dos submenus do menu de tarefa: projetos de destino (exclui o atual), prioridades e
	// categorias. Memoizado pra não recriar a lista a cada render do menu.
	const taskMenuData = useMemo(
		() => ({
			projects: projects
				.filter((project) => project.id !== selectedProjectId)
				.map((project) => ({ id: project.id, name: project.name, color: project.color })),
			priorities: (prioritiesQuery.data ?? []).map((priority) => ({
				id: priority.id,
				name: priority.name,
				color: priority.color,
			})),
			categories: (categoriesQuery.data ?? []).map((category) => ({
				id: category.id,
				name: category.name,
				color: category.color,
			})),
		}),
		[projects, prioritiesQuery.data, categoriesQuery.data, selectedProjectId],
	);

	const tree = useMemo(() => {
		const priorities = prioritiesQuery.data ?? [];
		const categories = categoriesQuery.data ?? [];

		if (!allProjects) {
			return buildVaultTree({
				entries,
				groups,
				skills: taskSkills,
				priorities,
				categories,
				projectColor: selectedProject?.color ?? null,
				hideCompleted,
				taskSort,
			});
		}

		// "Todos": uma subárvore namespaceada por projeto (ordem de display_order), só os projetos com
		// conteúdo. Skills/Agents ficam de fora (são por nome de projeto). O nó-projeto envolve cada
		// subárvore como uma feature não-acionável.
		return projects.flatMap((project) => {
			const projectEntries = entries.filter((entry) => entry.projectId === project.id);
			const projectGroups = groups.filter((group) => group.projectId === project.id);
			if (projectEntries.length === 0 && projectGroups.length === 0) return [];

			const keyPrefix = `project:${project.id}:`;
			const children = buildVaultTree({
				entries: projectEntries,
				groups: projectGroups,
				skills: [],
				priorities,
				categories,
				projectColor: project.color,
				hideCompleted,
				taskSort,
				keyPrefix,
				includeSkillsAgents: false,
			});

			return [
				{
					kind: "feature" as const,
					key: `project:${project.id}`,
					label: project.name,
					children,
				},
			];
		});
	}, [
		allProjects,
		projects,
		entries,
		groups,
		taskSkills,
		prioritiesQuery.data,
		categoriesQuery.data,
		selectedProject?.color,
		hideCompleted,
		taskSort,
	]);

	// Lookup nodeKey→entry: um nó selecionado pode estar sob pasta colapsada, então varre a árvore
	// inteira (não só as folhas visíveis).
	const entryByKey = useMemo(
		() => new Map(collectFileLeaves(tree).map((leaf) => [leaf.key, leaf.entry])),
		[tree],
	);

	// Lookup do destino do drop: chave da pasta de tarefa → taskId.
	const taskFolderByKey = useMemo(
		() => new Map(collectTaskFolders(tree).map((folder) => [folder.key, folder.taskId])),
		[tree],
	);

	// Busca poda a árvore e força os ancestrais dos acertos abertos, sem mexer no estado base.
	const searching = Boolean(search.trim());
	const filtered = useMemo(() => filterTree(tree, search), [tree, search]);
	const visibleNodes = searching ? filtered.nodes : tree;
	const visibleExpanded = useMemo(
		() => (searching ? new Set([...expanded, ...filtered.forcedOpen]) : expanded),
		[searching, expanded, filtered.forcedOpen],
	);

	function toggle(key: string) {
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}
			return next;
		});
	}

	function openFile(entry: VaultEntry) {
		if (entry.origin === "task" && entry.groupKey) {
			navigate({
				to: "/tarefas/$taskId/$file",
				params: { taskId: entry.groupKey, file: entry.name },
			});
			return;
		}
		// /vault/$fileName resolve o projeto pelo foco; em "Todos" o foco é undefined, então focamos o
		// projeto do arquivo antes de navegar (drill-in: abrir sai de "Todos"). Single: já está focado.
		if (allProjects) {
			setSelectedProjectId(entry.projectId);
		}
		navigate({ to: "/vault/$fileName", params: { fileName: entry.name } });
	}

	function openSkill(slug: string) {
		navigate({ to: "/skills/$slug", params: { slug } });
	}

	// Clique num arquivo: Shift = range, Ctrl/Cmd = toggle, simples = limpa seleção e abre (o
	// inerte não abre, mas ainda deseleciona). Em "Todos" não há ações de seleção (sem menu), então
	// qualquer clique só abre.
	function onActivateFile(node: TreeNode, mods: ClickModifiers) {
		if (node.kind !== "fileLeaf") return;

		const origin = node.entry.origin;
		const folderName = origin === "folder" ? node.entry.groupKey : null;

		if (allProjects) {
			if (origin !== "folder") {
				openFile(node.entry);
			}
			return;
		}

		if (mods.shift && anchorKey) {
			rangeSelect(node, origin, folderName);
			return;
		}
		if (mods.ctrl) {
			toggleSelect(node, origin, folderName);
			return;
		}
		clearSelection();
		if (origin !== "folder") {
			openFile(node.entry);
		}
	}

	function toggleSelect(node: TreeNode, origin: SelectionOrigin, folderName: string | null) {
		setSelection((prev) => {
			const compatible =
				prev.keys.size > 0 &&
				prev.origin === origin &&
				(origin !== "folder" || prev.folderName === folderName);
			const keys = compatible ? new Set(prev.keys) : new Set<string>();
			if (keys.has(node.key)) {
				keys.delete(node.key);
			} else {
				keys.add(node.key);
			}
			return { origin, folderName, keys };
		});
		setAnchorKey(node.key);
	}

	// Range sobre as folhas visíveis (ordem de exibição). Mantém a âncora fixa entre Shift-cliques.
	// Task pode atravessar várias tarefas (mover/soltar carregam o taskId por arquivo); folder fica
	// presa à mesma pasta. Âncora de origem incompatível vira seleção única nova.
	function rangeSelect(node: TreeNode, origin: SelectionOrigin, folderName: string | null) {
		if (node.kind !== "fileLeaf") return;

		const leaves = flattenVisibleLeaves(visibleNodes, visibleExpanded);
		const anchorIndex = leaves.findIndex((leaf) => leaf.key === anchorKey);
		const anchorLeaf = anchorIndex === -1 ? null : leaves[anchorIndex];
		const incompatibleAnchor =
			!anchorLeaf ||
			anchorLeaf.entry.origin !== origin ||
			(origin === "folder" && anchorLeaf.entry.groupKey !== folderName);

		if (incompatibleAnchor) {
			setSelection({ origin, folderName, keys: new Set([node.key]) });
			setAnchorKey(node.key);
			return;
		}

		const targetIndex = leaves.findIndex((leaf) => leaf.key === node.key);
		const [lo, hi] =
			anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
		const keys = new Set<string>();
		for (const leaf of leaves.slice(lo, hi + 1)) {
			if (leaf.entry.origin !== origin) continue;
			if (origin === "folder" && leaf.entry.groupKey !== folderName) continue;
			keys.add(leaf.key);
		}
		setSelection({ origin, folderName, keys });
	}

	const selectedEntries = useMemo(
		() =>
			[...selection.keys].flatMap((key) => {
				const entry = entryByKey.get(key);
				return entry ? [entry] : [];
			}),
		[selection.keys, entryByKey],
	);

	async function invalidateVaultAndTasks() {
		await queryClient.invalidateQueries({
			predicate: (query) =>
				Array.isArray(query.queryKey[0]) &&
				(query.queryKey[0][0] === "tasks" || query.queryKey[0][0] === "vault"),
		});
	}

	const linkMutation = useMutation({
		...orpc.vault.linkToTask.mutationOptions(),
		onSuccess: async (result) => {
			await invalidateVaultAndTasks();
			clearSelection();
			toast.success(
				result.count === 1 ? "Nota vinculada à tarefa" : `${result.count} notas vinculadas`,
			);
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Não foi possível vincular"),
	});

	const moveMutation = useMutation({
		...orpc.vault.moveToTask.mutationOptions(),
		onSuccess: async (result) => {
			await invalidateVaultAndTasks();
			clearSelection();
			toast.success(
				result.count === 1 ? "Arquivo movido para a tarefa" : `${result.count} arquivos movidos`,
			);
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Não foi possível mover"),
	});

	const moveFolderMutation = useMutation({
		...orpc.vault.moveFolderFilesToTask.mutationOptions(),
		onSuccess: async (result) => {
			await invalidateVaultAndTasks();
			clearSelection();
			toast.success(
				result.count === 1 ? "Arquivo movido para a tarefa" : `${result.count} arquivos movidos`,
			);
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Não foi possível mover"),
	});

	const unlinkMutation = useMutation({
		...orpc.vault.unlink.mutationOptions(),
		onSuccess: async (result) => {
			await invalidateVaultAndTasks();
			clearSelection();
			toast.success(
				result.count === 1 ? "Arquivo solto no vault" : `${result.count} arquivos soltos no vault`,
			);
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Não foi possível soltar"),
	});

	const adoptFolderMutation = useMutation({
		...orpc.vault.adoptFolder.mutationOptions(),
		onSuccess: async () => {
			await invalidateVaultAndTasks();
			toast.success("Pasta transformada em tarefa");
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Não foi possível transformar a pasta"),
	});

	const promoteMutation = useMutation({
		...orpc.vault.promote.mutationOptions(),
		onSuccess: async (result) => {
			await invalidateVaultAndTasks();
			toast.success("Nota transformada em tarefa");
			navigate({ to: "/tarefas/$taskId", params: { taskId: result.id } });
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Não foi possível transformar a nota"),
	});

	const renameMutation = useMutation({
		...orpc.vault.renameFile.mutationOptions(),
		onSuccess: async () => {
			await invalidateVaultAndTasks();
			setRenaming(null);
			toast.success("Nota renomeada");
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Não foi possível renomear"),
	});

	const deleteMutation = useMutation({
		...orpc.vault.deleteFile.mutationOptions(),
		onSuccess: async () => {
			await invalidateVaultAndTasks();
			setDeleting(null);
			toast.success("Nota deletada");
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Não foi possível deletar"),
	});

	const createNoteMutation = useMutation({
		...orpc.vault.writeFile.mutationOptions(),
		onSuccess: async (_result, variables) => {
			await invalidateVaultAndTasks();
			setCreatingTitle(null);
			navigate({ to: "/vault/$fileName", params: { fileName: variables.name } });
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Não foi possível criar a nota"),
	});

	const updateTaskMutation = useMutation({
		...orpc.tasks.update.mutationOptions(),
		onSuccess: async () => {
			await invalidateVaultAndTasks();
			setRenamingTask(null);
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Não foi possível atualizar a tarefa"),
	});

	const setTaskDoneMutation = useMutation({
		...orpc.tasks.setDone.mutationOptions(),
		onSuccess: async (task) => {
			await invalidateVaultAndTasks();
			toast.success(task?.done ? "Tarefa concluída" : "Tarefa reaberta");
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Não foi possível atualizar a tarefa"),
	});

	const removeTaskMutation = useMutation({
		...orpc.tasks.remove.mutationOptions(),
		onSuccess: async () => {
			await invalidateVaultAndTasks();
			setDeletingTask(null);
			toast.success("Tarefa excluída");
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Não foi possível excluir a tarefa"),
	});

	const moveTaskToProjectMutation = useMutation({
		...orpc.tasks.moveToProject.mutationOptions(),
		onSuccess: async () => {
			await invalidateVaultAndTasks();
			toast.success("Tarefa movida para o projeto");
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Não foi possível mover a tarefa"),
	});

	// Despacho único de movimento: o par (origem, destino) escolhe a mutation. Mesmo caminho pro
	// menu de contexto (single/lote) e pro drag-and-drop. `dest` = tarefa alvo ou a raiz solta.
	function dispatchMove(
		entries: VaultEntry[],
		origin: SelectionOrigin,
		folderName: string | null,
		dest: { taskId: string } | "root",
	) {
		if (entries.length === 0) return;

		if (dest === "root") {
			if (origin !== "task") return;
			unlinkMutation.mutate({
				projectId,
				files: entries.flatMap((entry) =>
					entry.groupKey ? [{ taskId: entry.groupKey, name: entry.name }] : [],
				),
			});
			return;
		}

		const taskId = dest.taskId;
		if (origin === "loose") {
			linkMutation.mutate({
				projectId,
				taskId,
				files: entries.map((entry) => ({ name: entry.name })),
			});
			return;
		}
		if (origin === "task") {
			// Pula arquivos que já estão na tarefa alvo (drop na própria tarefa = no-op parcial).
			const files = entries.flatMap((entry) =>
				entry.groupKey && entry.groupKey !== taskId
					? [{ taskId: entry.groupKey, name: entry.name }]
					: [],
			);
			if (files.length === 0) return;
			moveMutation.mutate({ projectId, targetTaskId: taskId, files });
			return;
		}
		// origin === "folder"
		if (!folderName) return;
		moveFolderMutation.mutate({
			projectId,
			folderName,
			targetTaskId: taskId,
			files: entries.map((entry) => entry.name),
		});
	}

	// Picker de tarefa de um nó só: monta o payload e cai no dispatch.
	function pickTask(node: TreeNode, taskId: string) {
		if (node.kind === "looseFolder") {
			dispatchMove(folderEntries(node), "folder", node.folderName, { taskId });
			return;
		}
		if (node.kind !== "fileLeaf") return;

		const origin = node.entry.origin;
		const folderName = origin === "folder" ? node.entry.groupKey : null;
		dispatchMove([node.entry], origin, folderName, { taskId });
	}

	// Diretório absoluto pela chave do grupo (folder_path do backend + raiz do projeto).
	function dirFromGroup(route: string, groupKey: string): string | null {
		const folderPath = groupFolderPath.get(groupKey);
		return folderPath ? joinPath(route, folderPath) : null;
	}

	// Diretório absoluto de um nó pros comandos do SO. A skill traz o dir absoluto; tarefa/pasta
	// solta/arquivo resolvem pelo folder_path do backend (via groupFolderPath). A nota solta vive na
	// raiz do vault (ROOT_KEY). Sem projeto/folder_path resolvido, null (as ações viram no-op).
	function nodeDir(node: TreeNode): string | null {
		const route = selectedProject?.mainRoute;
		if (!route) return null;
		if (node.kind === "skillFolder") return node.primaryDir;
		if (node.kind === "taskFolder") return dirFromGroup(route, node.taskId);
		if (node.kind === "looseFolder") return dirFromGroup(route, node.folderName);
		if (node.kind === "fileLeaf") {
			const entry = node.entry;
			if (entry.origin === "loose") return joinPath(route, ROOT_KEY);
			if (!entry.groupKey) return null;
			return dirFromGroup(route, entry.groupKey);
		}
		return null;
	}

	// Conteúdo concatenado de uma pasta de tarefa/solta (via backend) ou as instruções da skill
	// (já carregadas no nó). Só chamado em pastas — o submenu Compartilhar não aparece em arquivo.
	async function shareNodeContent(node: TreeNode) {
		if (node.kind === "skillFolder") {
			await copyMarkdown(node.instructions);
			return;
		}
		if (!projectId) return;
		if (node.kind !== "taskFolder" && node.kind !== "looseFolder") return;

		const target =
			node.kind === "taskFolder"
				? ({ kind: "task", taskId: node.taskId } as const)
				: ({ kind: "folder", folderName: node.folderName } as const);

		try {
			const result = await queryClient.fetchQuery({
				...orpc.vault.exportContent.queryOptions({ input: { projectId, target } }),
				staleTime: 0,
			});
			await copyMarkdown(result.content);
		} catch {
			toast.error("Não foi possível exportar o conteúdo");
		}
	}

	const actions: TreeActions = {
		onOpenInOs: (node) => {
			const dir = nodeDir(node);
			if (dir) void openFolderInOs(dir);
		},
		onShareContent: (node) => void shareNodeContent(node),
		onShareZip: (node) => {
			const dir = nodeDir(node);
			if (dir) void shareFolderAsZip(dir);
		},
		onRename: (node) => {
			if (node.kind === "fileLeaf") setRenaming({ name: node.entry.name, value: node.entry.name });
		},
		onDelete: (node) => {
			if (node.kind === "fileLeaf") setDeleting(node.entry.name);
		},
		onPromote: (node) => {
			if (node.kind === "fileLeaf") promoteMutation.mutate({ projectId, name: node.entry.name });
		},
		onAdopt: (node) => {
			if (node.kind === "looseFolder") {
				adoptFolderMutation.mutate({ projectId, folderName: node.folderName });
			}
		},
		onUnlink: (node) => {
			if (node.kind === "fileLeaf" && node.entry.origin === "task") {
				dispatchMove([node.entry], "task", null, "root");
			}
		},
		onPickTask: pickTask,
		onOpenTask: (node) => navigate({ to: "/tarefas/$taskId", params: { taskId: node.taskId } }),
		onRenameTask: (node) => {
			// Pré-preenche com o título cru (não o displayTitle derivado do conteúdo): renomear edita o
			// título de verdade. A task sem título abre o input vazio.
			const task = tasksQuery.data?.find((item) => item.id === node.taskId);
			setRenamingTask({ id: node.taskId, value: task?.title ?? "" });
		},
		onSetTaskPriority: (node, priorityId) =>
			updateTaskMutation.mutate({ id: node.taskId, priorityId }),
		onSetTaskCategory: (node, categoryId) =>
			updateTaskMutation.mutate({ id: node.taskId, categoryId }),
		onToggleTaskDone: (node) => setTaskDoneMutation.mutate({ id: node.taskId, done: !node.done }),
		onMoveTaskToProject: (node, projectId) =>
			moveTaskToProjectMutation.mutate({ id: node.taskId, targetProjectId: projectId }),
		onDeleteTask: (node) => setDeletingTask({ id: node.taskId, title: node.label }),
	};

	// Picker do menu de lote: pra task, exclui TODAS as tarefas de origem (não só uma).
	const selectedSourceTaskIds = useMemo(
		() =>
			selection.origin === "task"
				? new Set(selectedEntries.map((entry) => entry.groupKey))
				: new Set<string | null>(),
		[selection.origin, selectedEntries],
	);
	const batchTaskOptions =
		selection.origin === "task"
			? taskOptions.filter((task) => !selectedSourceTaskIds.has(task.id))
			: taskOptions;

	function batchPickTask(taskId: string) {
		dispatchMove(selectedEntries, selection.origin, selection.folderName, { taskId });
	}

	function batchUnlink() {
		dispatchMove(selectedEntries, "task", null, "root");
	}

	function onDragStart(event: DragStartEvent) {
		const key = String(event.active.id);
		const entry = entryByKey.get(key);
		if (!entry) {
			setDrag(null);
			return;
		}
		if (selection.keys.has(key)) {
			setDrag({
				entries: selectedEntries,
				origin: selection.origin,
				folderName: selection.folderName,
			});
			return;
		}
		const origin = entry.origin;
		setDrag({ entries: [entry], origin, folderName: origin === "folder" ? entry.groupKey : null });
	}

	function onDragEnd(event: DragEndEvent) {
		const payload = drag;
		const overId = event.over ? String(event.over.id) : null;
		setDrag(null);
		if (!payload || !overId) return;

		if (overId === ROOT_DROP_ID) {
			dispatchMove(payload.entries, payload.origin, payload.folderName, "root");
			return;
		}
		const taskId = taskFolderByKey.get(overId);
		if (taskId) {
			dispatchMove(payload.entries, payload.origin, payload.folderName, { taskId });
		}
	}

	// Pasta de tarefa é destino válido enquanto há arraste. Filtra a própria tarefa só quando a
	// origem é task e a seleção inteira vem dela (drop nela seria no-op).
	function canDrop(node: TreeNode) {
		if (!drag || node.kind !== "taskFolder") return false;
		if (drag.origin === "task" && drag.entries.every((entry) => entry.groupKey === node.taskId)) {
			return false;
		}
		return true;
	}

	function confirmCreateNote() {
		if (creatingTitle === null) return;
		const base = creatingTitle.trim().replaceAll(/[/\\]/g, "-").replace(/^\.+/, "");
		if (!base) return;

		const name = `${base}.md`;
		if (looseNames.has(name)) {
			toast.error("Já existe uma nota com esse nome");
			return;
		}
		createNoteMutation.mutate({ projectId, name, content: `# ${base}\n\n` });
	}

	function confirmRename() {
		if (!renaming) return;
		const newName = renaming.value.trim();
		if (!newName || newName === renaming.name) {
			setRenaming(null);
			return;
		}
		if (!newName.endsWith(".md")) {
			toast.error("O nome deve terminar em .md");
			return;
		}
		renameMutation.mutate({ projectId, oldName: renaming.name, newName });
	}

	if (projects.length === 0) {
		return (
			<PageShell title="Vault" icon={Library}>
				<Text size="sm" tone="muted">
					Crie um projeto para ver o vault.
				</Text>
			</PageShell>
		);
	}

	// Somente-leitura em "Todos": só browse + abrir (drill-in). Mutations/DnD/menu são single-project.
	const readOnly = allProjects;

	// Conta entries soltas diretas (não o Set de nomes: em "Todos" nomes iguais em projetos distintos
	// deduplicariam no Set e subcontariam o total agregado).
	const looseCount = entries.filter((entry) => entry.origin === "loose").length;
	const folderCount = groups.filter((group) => group.kind === "folder").length;
	const taskCount = groups.filter((group) => group.kind === "task").length;
	const description = allProjects
		? `${looseCount} soltas · ${folderCount} pastas · ${taskCount} em tarefas · todos os projetos`
		: `${looseCount} soltas · ${folderCount} pastas · ${taskCount} em tarefas de ${selectedProject?.name ?? "projeto"}`;

	return (
		<PageShell title="Vault" icon={Library} description={description}>
			{entriesQuery.isLoading ? (
				<div className="flex items-center gap-2 text-muted-foreground">
					<Loader2 size={16} className="animate-spin" />
					<Text size="sm" tone="muted">
						Carregando vault...
					</Text>
				</div>
			) : (
				<div className="flex h-full min-h-0 flex-col">
					<div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-1">
						<div className="relative w-full sm:w-auto sm:flex-1">
							<Search
								size={15}
								className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
							/>
							<Input
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								placeholder="Buscar por nome ou título"
								className="pl-9 font-mono text-sm"
								aria-label="Buscar no vault"
							/>
						</div>
						<div className="flex items-center gap-1">
							<Divider className="hidden sm:block" />

							<Tooltip label="Colapsar tudo">
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									aria-label="Colapsar tudo"
									className="text-muted-foreground"
									onClick={() => setExpanded(new Set())}
								>
									<ChevronsDownUp className="size-4" />
								</Button>
							</Tooltip>
							<Tooltip label="Expandir tudo">
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									aria-label="Expandir tudo"
									className="text-muted-foreground"
									onClick={() => setExpanded(new Set(collectFolderKeys(tree)))}
								>
									<ChevronsUpDown className="size-4" />
								</Button>
							</Tooltip>
							<Divider />

							<Tooltip label={hideCompleted ? "Mostrar concluídas" : "Ocultar concluídas"}>
								<Button
									type="button"
									variant={hideCompleted ? "secondary" : "ghost"}
									size="icon-sm"
									aria-label="Ocultar tarefas concluídas"
									aria-pressed={hideCompleted}
									className={hideCompleted ? undefined : "text-muted-foreground"}
									onClick={() => setHideCompleted((prev) => !prev)}
								>
									<CircleCheck className="size-4" />
								</Button>
							</Tooltip>
							{!readOnly && (
								<>
									<Divider className="hidden sm:block" />
									<Tooltip label="Nova nota solta">
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="ml-auto sm:ml-0"
											onClick={() => setCreatingTitle("")}
										>
											<Plus className="size-4" />
											Nova nota
										</Button>
									</Tooltip>
								</>
							)}
						</div>
					</div>

					{selection.keys.size > 0 && (
						<div className="mb-2 flex items-center justify-between border border-border bg-card px-3 py-1.5">
							<Text size="sm" className="font-mono tabular-nums">
								{selection.keys.size} selecionada{selection.keys.size > 1 ? "s" : ""} · botão
								direito para ações
							</Text>
							<Button variant="ghost" size="sm" onClick={clearSelection}>
								<X className="size-4" />
								Limpar
							</Button>
						</div>
					)}

					{(() => {
						// Em "Todos" (readOnly) a árvore é só browse + abrir: sem DnD nem menu de contexto,
						// então omitimos canDrop/wrapNode/renderAccessory e não montamos o DndContext.
						const treeView =
							searching && visibleNodes.length === 0 ? (
								<Text size="sm" tone="muted" className="px-2 py-1 font-mono">
									Nada encontrado para “{search.trim()}”.
								</Text>
							) : (
								<Tree
									nodes={visibleNodes}
									expanded={visibleExpanded}
									selectedKeys={selection.keys}
									onToggle={toggle}
									onActivateFile={onActivateFile}
									onOpenSkill={openSkill}
									canDrop={readOnly ? undefined : canDrop}
									renderAccessory={
										readOnly
											? undefined
											: (node) =>
													node.key === TAREFAS_KEY ? (
														<TaskSortControl mode={taskSort} onChange={setTaskSort} />
													) : null
									}
									wrapNode={
										readOnly
											? undefined
											: (node, row, onOpenChange) =>
													node.kind === "fileLeaf" && selection.keys.has(node.key) ? (
														<TreeBatchMenu
															origin={selection.origin}
															count={selection.keys.size}
															tasks={batchTaskOptions}
															onPickTask={batchPickTask}
															onUnlink={batchUnlink}
															onOpenChange={onOpenChange}
														>
															{row}
														</TreeBatchMenu>
													) : (
														<TreeNodeMenu
															node={node}
															tasks={taskOptions}
															taskMenuData={taskMenuData}
															actions={actions}
															onOpenChange={onOpenChange}
														>
															{row}
														</TreeNodeMenu>
													)
									}
								/>
							);

						if (readOnly) {
							return <div className="min-h-0 flex-1 overflow-y-auto pr-2">{treeView}</div>;
						}

						return (
							<DndContext
								sensors={sensors}
								collisionDetection={pointerWithin}
								onDragStart={onDragStart}
								onDragEnd={onDragEnd}
								onDragCancel={() => setDrag(null)}
							>
								{drag?.origin === "task" && <RootDropZone />}

								<div className="min-h-0 flex-1 overflow-y-auto pr-2">{treeView}</div>

								<DragOverlay dropAnimation={null}>
									{drag ? (
										<div className="pointer-events-none flex items-center gap-1.5 border border-primary bg-card px-2 py-1 shadow-lg">
											<Files className="size-3.5 text-primary" />
											<Text size="xs" className="font-mono">
												{drag.entries.length} arquivo{drag.entries.length > 1 ? "s" : ""}
											</Text>
										</div>
									) : null}
								</DragOverlay>
							</DndContext>
						);
					})()}
				</div>
			)}

			{creatingTitle !== null && (
				<div className="fixed inset-0 z-50 flex items-center justify-center">
					<button
						type="button"
						aria-label="Fechar"
						onClick={() => setCreatingTitle(null)}
						className="absolute inset-0 bg-black/50"
					/>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							confirmCreateNote();
						}}
						className="relative z-10 w-full max-w-md border border-border bg-background p-6 shadow-lg animate-in fade-in-0 zoom-in-95"
					>
						<Text size="sm" tone="muted" className="mb-3">
							Nova nota solta
						</Text>
						<Input
							autoFocus
							value={creatingTitle}
							onChange={(e) => setCreatingTitle(e.target.value)}
							placeholder="Título da nota"
							className="font-mono text-sm"
							aria-label="Título"
						/>
						{creatingTitle.trim() && (
							<Text size="xs" tone="muted" className="mt-2 font-mono">
								arquivo: {creatingTitle.trim().replaceAll(/[/\\]/g, "-").replace(/^\.+/, "")}.md
							</Text>
						)}
						<div className="mt-6 flex justify-end gap-3">
							<Button type="button" variant="outline" onClick={() => setCreatingTitle(null)}>
								Cancelar
							</Button>
							<Button type="submit" disabled={createNoteMutation.isPending}>
								{createNoteMutation.isPending ? "Criando..." : "Criar nota"}
							</Button>
						</div>
					</form>
				</div>
			)}

			{renaming && (
				<div className="fixed inset-0 z-50 flex items-center justify-center">
					<button
						type="button"
						aria-label="Fechar"
						onClick={() => setRenaming(null)}
						className="absolute inset-0 bg-black/50"
					/>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							confirmRename();
						}}
						className="relative z-10 w-full max-w-md border border-border bg-background p-6 shadow-lg animate-in fade-in-0 zoom-in-95"
					>
						<Text size="sm" tone="muted" className="mb-3">
							Renomear nota
						</Text>
						<Input
							autoFocus
							value={renaming.value}
							onChange={(e) => setRenaming({ name: renaming.name, value: e.target.value })}
							placeholder="nome.md"
							className="font-mono text-sm"
							aria-label="Novo nome"
						/>
						<div className="mt-6 flex justify-end gap-3">
							<Button type="button" variant="outline" onClick={() => setRenaming(null)}>
								Cancelar
							</Button>
							<Button type="submit" disabled={renameMutation.isPending}>
								{renameMutation.isPending ? "Aguarde..." : "Renomear"}
							</Button>
						</div>
					</form>
				</div>
			)}

			<ConfirmDialog
				open={deleting !== null}
				onClose={() => setDeleting(null)}
				onConfirm={() => deleting && deleteMutation.mutate({ projectId, name: deleting })}
				title="Deletar nota"
				description={deleting ? `“${deleting}” será apagada permanentemente do disco.` : undefined}
				confirmLabel="Deletar"
				variant="danger"
				loading={deleteMutation.isPending}
			/>

			{renamingTask && (
				<div className="fixed inset-0 z-50 flex items-center justify-center">
					<button
						type="button"
						aria-label="Fechar"
						onClick={() => setRenamingTask(null)}
						className="absolute inset-0 bg-black/50"
					/>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							updateTaskMutation.mutate({ id: renamingTask.id, title: renamingTask.value.trim() });
						}}
						className="relative z-10 w-full max-w-md border border-border bg-background p-6 shadow-lg animate-in fade-in-0 zoom-in-95"
					>
						<Text size="sm" tone="muted" className="mb-3">
							Renomear tarefa
						</Text>
						<Input
							autoFocus
							value={renamingTask.value}
							onChange={(e) => setRenamingTask({ id: renamingTask.id, value: e.target.value })}
							placeholder="Título da tarefa"
							className="text-sm"
							aria-label="Novo título"
						/>
						<div className="mt-6 flex justify-end gap-3">
							<Button type="button" variant="outline" onClick={() => setRenamingTask(null)}>
								Cancelar
							</Button>
							<Button type="submit" disabled={updateTaskMutation.isPending}>
								{updateTaskMutation.isPending ? "Aguarde..." : "Renomear"}
							</Button>
						</div>
					</form>
				</div>
			)}

			<ConfirmDialog
				open={deletingTask !== null}
				onClose={() => setDeletingTask(null)}
				onConfirm={() => deletingTask && removeTaskMutation.mutate({ id: deletingTask.id })}
				title="Excluir tarefa"
				description={
					deletingTask
						? `“${deletingTask.title}” e todos os seus arquivos serão removidos permanentemente.`
						: undefined
				}
				confirmLabel="Excluir"
				variant="danger"
				loading={removeTaskMutation.isPending}
			/>
		</PageShell>
	);
}

function Divider({ className }: { className?: string }) {
	return <div className={cn("mx-1 h-5 w-px shrink-0 bg-border", className)} />;
}

const SORT_OPTIONS: { mode: TaskSortMode; label: string; icon: typeof Clock }[] = [
	{ mode: "recente", label: "Mais recentes", icon: Clock },
	{ mode: "prioridade", label: "Por prioridade", icon: Flame },
	{ mode: "categoria", label: "Por categoria", icon: LayoutGrid },
];

// Ordenação inline das pastas de tarefa, irmã do botão da linha "Tarefas". `stopPropagation` evita
// que o clique colapse/expanda a pasta.
function TaskSortControl({
	mode,
	onChange,
}: {
	mode: TaskSortMode;
	onChange: (mode: TaskSortMode) => void;
}) {
	return (
		<div className="flex shrink-0 items-center gap-0.5 pr-2">
			{SORT_OPTIONS.map((option) => {
				const active = option.mode === mode;
				return (
					<Tooltip key={option.mode} label={option.label}>
						<Button
							type="button"
							variant={active ? "secondary" : "ghost"}
							size="icon-sm"
							aria-label={option.label}
							aria-pressed={active}
							className={active ? undefined : "text-muted-foreground"}
							onClick={(event) => {
								event.stopPropagation();
								onChange(option.mode);
							}}
						>
							<option.icon className="size-3.5" />
						</Button>
					</Tooltip>
				);
			})}
		</div>
	);
}

// Zona de drop pra soltar arquivos de uma tarefa de volta no vault (unlink). Fixa no rodapé e fora
// do fluxo (não empurra a lista); só renderiza durante um arraste de origem task.
function RootDropZone() {
	const { setNodeRef, isOver } = useDroppable({ id: ROOT_DROP_ID });

	return (
		<div
			ref={setNodeRef}
			className={cn(
				"fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-3 border-t-2 border-dashed py-6 backdrop-blur-sm transition-colors",
				isOver
					? "border-primary bg-primary/15 text-primary"
					: "border-border bg-background/80 text-muted-foreground",
			)}
		>
			<Unlink className={cn("size-6 transition-transform", isOver && "scale-110")} />
			<Text size="lg" className="font-mono font-medium">
				Soltar aqui para tirar da tarefa
			</Text>
		</div>
	);
}
