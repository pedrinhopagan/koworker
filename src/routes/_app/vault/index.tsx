import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	CheckSquare,
	ChevronsDownUp,
	ChevronsUpDown,
	FolderInput,
	LayoutGrid,
	Library,
	Link2,
	ListTree,
	Loader2,
	Search,
	Unlink,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { PageShell } from "@/components/layout/page-shell";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { cn } from "@/lib/utils";
import { LinkTaskPopover, type NewTaskPayload } from "./-components/link-task-popover";
import { VaultBrowser } from "./-components/vault-browser";
import {
	EMPTY_VAULT_FILTERS,
	filterEntries,
	type VaultFilterState,
	VaultFilters,
} from "./-components/vault-filters";
import { VaultGroupedView } from "./-components/vault-grouped-view";

export const Route = createFileRoute("/_app/vault/")({
	component: VaultPage,
});

// Adiciona/remove uma chave de um Set imutável (toggle de seleção).
function toggleKey(set: Set<string>, key: string): Set<string> {
	const next = new Set(set);
	if (next.has(key)) {
		next.delete(key);
	} else {
		next.add(key);
	}
	return next;
}

function VaultPage() {
	const { selectedProjectId, selectedProject } = useProjectFocus();
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	// Três seleções mutuamente exclusivas: notas soltas (por nome), arquivos dentro de uma pasta
	// solta (por pasta/nome) e arquivos já vinculados a tarefas (por taskId/nome). Cada uma habilita
	// ações diferentes, então mexer numa zera as outras. (Fatia 1: a lista plana só abre arquivos;
	// estas seleções e as barras de lote ficam inertes até o modo "organizar" da Fatia 4.)
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [folderSelected, setFolderSelected] = useState<Set<string>>(new Set());
	const [linkedSelected, setLinkedSelected] = useState<Set<string>>(new Set());

	// Nota solta sob ação do menu de contexto: renomear abre um diálogo com input, deletar
	// abre a confirmação. Só uma fica ativa por vez.
	const [renaming, setRenaming] = useState<{ name: string; value: string } | null>(null);
	const [deleting, setDeleting] = useState<string | null>(null);

	// Criação de nota solta: o dialog pede só um título e deriva o nome do arquivo.
	const [creatingTitle, setCreatingTitle] = useState<string | null>(null);

	// Busca: filtra entries por nome+título no cliente. Enquanto há termo, a lista colapsa pra
	// plano (visão de resultados), ignorando o agrupamento.
	const [search, setSearch] = useState("");

	// Grupos colapsados na visão agrupada (chave `folder:<nome>` ou `task:<id>`). Preferência local,
	// sem persistência — recompõe a cada montagem.
	const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

	// Filtros das 4 dimensões (Fatia 2). Padrão = pendentes (concluídas ocultas).
	const [filters, setFilters] = useState<VaultFilterState>(EMPTY_VAULT_FILTERS);

	// Modo de agrupamento (Fatia 3). Padrão = "grouped" (visão da Fatia 1); "flat" é a grade única
	// sem cabeçalhos. Com termo de busca, a lista cai pra plana independente do toggle.
	const [grouping, setGrouping] = useState<"grouped" | "flat">("grouped");

	// Modo "organizar" (Fatia 4): fora dele o clique abre o arquivo; dentro, seleciona pra lote. As
	// barras flutuantes (vincular/mover/soltar) só aparecem aqui.
	const [organizing, setOrganizing] = useState(false);

	useEffect(() => {
		setSelected(new Set());
		setFolderSelected(new Set());
		setLinkedSelected(new Set());
		setRenaming(null);
		setDeleting(null);
		setSearch("");
		setCollapsed(new Set());
		setFilters(EMPTY_VAULT_FILTERS);
		setGrouping("grouped");
		setOrganizing(false);
	}, [selectedProjectId]);

	// Sair do modo organizar limpa as três seleções: senão as barras lingerem ou reentrar mostraria
	// uma seleção velha.
	function toggleOrganizing() {
		setOrganizing((prev) => {
			if (prev) {
				setSelected(new Set());
				setFolderSelected(new Set());
				setLinkedSelected(new Set());
			}
			return !prev;
		});
	}

	// Seleção de um arquivo no modo organizar. As três seleções são mutuamente exclusivas (cada
	// origem habilita ações diferentes), então mexer numa zera as outras. As chaves seguem o formato
	// que os parsers já esperam: loose = nome puro; folder/task = `<groupKey>/<nome>`.
	function selectEntry(entry: { name: string; origin: string; groupKey: string | null }) {
		if (entry.origin === "loose") {
			setFolderSelected(new Set());
			setLinkedSelected(new Set());
			setSelected((prev) => toggleKey(prev, entry.name));
			return;
		}
		if (!entry.groupKey) return;

		const key = `${entry.groupKey}/${entry.name}`;
		if (entry.origin === "folder") {
			setSelected(new Set());
			setLinkedSelected(new Set());
			// A barra de mover-pasta resolve uma única pasta de origem; selecionar arquivo de outra
			// pasta recomeça a seleção em vez de misturar duas origens.
			setFolderSelected((prev) => {
				const sameFolder = [...prev].every((k) => k.slice(0, k.indexOf("/")) === entry.groupKey);
				return toggleKey(sameFolder ? prev : new Set(), key);
			});
			return;
		}
		setSelected(new Set());
		setFolderSelected(new Set());
		setLinkedSelected((prev) => toggleKey(prev, key));
	}

	function isEntrySelected(entry: {
		name: string;
		origin: string;
		groupKey: string | null;
	}): boolean {
		if (entry.origin === "loose") return selected.has(entry.name);
		if (!entry.groupKey) return false;
		const key = `${entry.groupKey}/${entry.name}`;
		return entry.origin === "folder" ? folderSelected.has(key) : linkedSelected.has(key);
	}

	// "Selecionar todos" de um grupo (cabeçalho): substitui a seleção da origem do grupo pelos seus
	// arquivos e zera as outras duas (a exclusividade por origem vale também aqui). Um grupo é
	// homogêneo em origem, então o primeiro item decide o destino.
	function selectGroup(groupEntries: { name: string; origin: string; groupKey: string | null }[]) {
		const first = groupEntries[0];
		if (!first) return;

		if (first.origin === "loose") {
			setFolderSelected(new Set());
			setLinkedSelected(new Set());
			setSelected(new Set(groupEntries.map((entry) => entry.name)));
			return;
		}

		const keys = new Set(groupEntries.map((entry) => `${entry.groupKey}/${entry.name}`));
		if (first.origin === "folder") {
			setSelected(new Set());
			setLinkedSelected(new Set());
			setFolderSelected(keys);
			return;
		}
		setSelected(new Set());
		setFolderSelected(new Set());
		setLinkedSelected(keys);
	}

	function toggleCollapsed(key: string) {
		setCollapsed((prev) => {
			const next = new Set(prev);
			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}
			return next;
		});
	}

	const projectId = selectedProjectId ?? "";
	const enabled = Boolean(selectedProjectId);

	// Endpoint agregador do vault: lista plana de arquivos (entries, metadata-only) + os grupos
	// (pastas soltas e tasks). Cobre as três fontes que antes vinham de queries separadas.
	const entriesQuery = useQuery({
		...orpc.vault.listEntries.queryOptions({ input: { projectId } }),
		enabled,
	});

	// Todas as tasks do projeto (inclusive vazias) — alvo de "mover/redirecionar" nas barras de lote.
	// O agregador do vault só devolve grupos com arquivo, então uma task vazia não apareceria como
	// destino sem esta lista separada.
	const tasksQuery = useQuery({
		...orpc.tasks.listByProject.queryOptions({ input: { projectId } }),
		enabled,
	});

	const entries = entriesQuery.data?.entries ?? [];
	const groups = entriesQuery.data?.groups ?? [];

	const looseNames = useMemo(
		() => new Set(entries.filter((entry) => entry.origin === "loose").map((entry) => entry.name)),
		[entries],
	);
	const taskGroups = useMemo(() => groups.filter((group) => group.kind === "task"), [groups]);
	const folderGroups = useMemo(() => groups.filter((group) => group.kind === "folder"), [groups]);

	// Pipeline de filtros (Fatia 2): predicados sobre a lista plana, antes do agrupamento. O estado
	// "pendentes" (padrão) é o que mantém as concluídas ocultas — o chip de estado as revela.
	const taskGroupByKey = useMemo(
		() => new Map(taskGroups.map((group) => [group.key, group])),
		[taskGroups],
	);
	const filteredEntries = useMemo(
		() => filterEntries(entries, filters, taskGroupByKey),
		[entries, filters, taskGroupByKey],
	);
	// Grupos recompostos a partir das entries que sobreviveram: um grupo só aparece se tem arquivo
	// no resultado filtrado.
	const survivingKeys = useMemo(
		() => new Set(filteredEntries.map((entry) => entry.groupKey).filter((key) => key !== null)),
		[filteredEntries],
	);
	const visibleTaskGroups = useMemo(
		() => taskGroups.filter((group) => survivingKeys.has(group.key)),
		[taskGroups, survivingKeys],
	);
	const visibleFolderGroups = useMemo(
		() => folderGroups.filter((group) => survivingKeys.has(group.key)),
		[folderGroups, survivingKeys],
	);

	// Atalhos de colapsar/expandir tudo (só na visão agrupada). As chaves seguem o formato que
	// VaultGroupedView usa: `folder:<key>` e `task:<key>`.
	function collapseAllGroups() {
		const keys = new Set<string>();
		for (const group of visibleFolderGroups) keys.add(`folder:${group.key}`);
		for (const group of visibleTaskGroups) keys.add(`task:${group.key}`);
		setCollapsed(keys);
	}

	function expandAllGroups() {
		setCollapsed(new Set());
	}
	const looseCount = looseNames.size;
	// Opções de destino das barras de lote: todas as tasks do projeto, inclusive as vazias (alvo de
	// redirecionar), via tasksQuery — não só os grupos com arquivo.
	const taskOptions = useMemo(
		() => (tasksQuery.data ?? []).map((task) => ({ id: task.id, displayTitle: task.displayTitle })),
		[tasksQuery.data],
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
			if (result.renamed.length > 0) {
				const renames = result.renamed.map((file) => `${file.name} → ${file.finalName}`).join(", ");
				toast.success(`${result.count} arquivada(s) — renomeada(s) por conflito: ${renames}`);
			} else {
				toast.success(
					result.count === 1
						? "Nota arquivada na tarefa"
						: `${result.count} notas arquivadas na tarefa`,
				);
			}
			setSelected(new Set());
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Não foi possível vincular"),
	});

	const moveMutation = useMutation({
		...orpc.vault.moveToTask.mutationOptions(),
		onSuccess: async (result) => {
			await invalidateVaultAndTasks();
			toast.success(
				result.count === 1 ? "Arquivo movido para a tarefa" : `${result.count} arquivos movidos`,
			);
			setLinkedSelected(new Set());
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Não foi possível mover"),
	});

	const moveFolderMutation = useMutation({
		...orpc.vault.moveFolderFilesToTask.mutationOptions(),
		onSuccess: async (result) => {
			await invalidateVaultAndTasks();
			toast.success(
				result.count === 1 ? "Arquivo movido para a tarefa" : `${result.count} arquivos movidos`,
			);
			setFolderSelected(new Set());
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Não foi possível mover"),
	});

	const unlinkMutation = useMutation({
		...orpc.vault.unlink.mutationOptions(),
		onSuccess: async (result) => {
			await invalidateVaultAndTasks();
			if (result.renamed.length > 0) {
				const renames = result.renamed.map((file) => `${file.name} → ${file.finalName}`).join(", ");
				toast.success(`${result.count} soltas — renomeadas por conflito: ${renames}`);
			} else {
				toast.success(
					result.count === 1
						? "Arquivo solto no vault"
						: `${result.count} arquivos soltos no vault`,
				);
			}
			setLinkedSelected(new Set());
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Não foi possível soltar"),
	});

	const createTaskMutation = useMutation(orpc.tasks.create.mutationOptions());

	// Transforma uma pasta solta em tarefa (aponta a task nova pra pasta existente, sem mover
	// arquivo). A pasta deixa de ser grupo "folder" e passa a aparecer como grupo "task".
	const adoptFolderMutation = useMutation({
		...orpc.vault.adoptFolder.mutationOptions(),
		onSuccess: async () => {
			await invalidateVaultAndTasks();
			toast.success("Pasta transformada em tarefa");
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Não foi possível transformar a pasta"),
	});

	// Cria um `.md` solto na raiz do vault com um H1 inicial e abre a nota pra editar.
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

	// Cria a tarefa de destino com a pasta vazia (seed: false), pra os arquivos redirecionados
	// entrarem sem colidir com um index.md de boilerplate. Devolve o id pra encadear o redirect.
	async function createTaskForRedirect(payload: NewTaskPayload): Promise<string | null> {
		try {
			const task = await createTaskMutation.mutateAsync({ projectId, ...payload, seed: false });
			if (!task) throw new Error("Não foi possível criar a tarefa");
			return task.id;
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Não foi possível criar a tarefa");
			return null;
		}
	}

	const renameMutation = useMutation({
		...orpc.vault.renameFile.mutationOptions(),
		onSuccess: async (result) => {
			await invalidateVaultAndTasks();
			setSelected((prev) => {
				if (!prev.has(result.oldName)) return prev;
				const next = new Set(prev);
				next.delete(result.oldName);
				next.add(result.newName);
				return next;
			});
			setRenaming(null);
			toast.success("Nota renomeada");
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Não foi possível renomear"),
	});

	const deleteMutation = useMutation({
		...orpc.vault.deleteFile.mutationOptions(),
		onSuccess: async (result) => {
			await invalidateVaultAndTasks();
			setSelected((prev) => {
				if (!prev.has(result.name)) return prev;
				const next = new Set(prev);
				next.delete(result.name);
				return next;
			});
			setDeleting(null);
			toast.success("Nota deletada");
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Não foi possível deletar"),
	});

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

	function linkSelected(taskId: string, targetName?: string) {
		const names = [...selected];
		linkMutation.mutate({
			projectId,
			taskId,
			files: names.map((name, index) => ({
				name,
				targetName: names.length === 1 && index === 0 ? targetName : undefined,
			})),
		});
	}

	async function linkSelectedToNew(payload: NewTaskPayload, targetName?: string) {
		const id = await createTaskForRedirect(payload);
		if (id) linkSelected(id, targetName);
	}

	// Reverte a chave taskId/name de volta pra { taskId, name }. Só o primeiro "/" separa:
	// nomes de arquivo nunca têm "/" (bloqueado pelo schema), mas o split limitado é defensivo.
	const linkedFiles = useMemo(
		() =>
			[...linkedSelected].map((key) => {
				const slash = key.indexOf("/");
				return { taskId: key.slice(0, slash), name: key.slice(slash + 1) };
			}),
		[linkedSelected],
	);

	const linkedSourceTaskIds = useMemo(
		() => new Set(linkedFiles.map((file) => file.taskId)),
		[linkedFiles],
	);

	function moveSelected(targetTaskId: string) {
		moveMutation.mutate({ projectId, targetTaskId, files: linkedFiles });
	}

	async function moveSelectedToNew(payload: NewTaskPayload) {
		const id = await createTaskForRedirect(payload);
		if (id) moveSelected(id);
	}

	function unlinkSelected() {
		unlinkMutation.mutate({ projectId, files: linkedFiles });
	}

	// Arquivos da pasta solta selecionados, com a pasta de origem (única por seleção).
	const folderFiles = useMemo(
		() =>
			[...folderSelected].map((key) => {
				const slash = key.indexOf("/");
				return { folderName: key.slice(0, slash), name: key.slice(slash + 1) };
			}),
		[folderSelected],
	);
	const activeFolderName = folderFiles[0]?.folderName ?? null;

	function moveFolderSelected(targetTaskId: string) {
		if (!activeFolderName) return;
		moveFolderMutation.mutate({
			projectId,
			folderName: activeFolderName,
			targetTaskId,
			files: folderFiles.map((file) => file.name),
		});
	}

	async function moveFolderSelectedToNew(payload: NewTaskPayload) {
		const id = await createTaskForRedirect(payload);
		if (id) moveFolderSelected(id);
	}

	// Abre um arquivo: task → rota da aba da tarefa; loose → rota da nota solta. Arquivos de pasta
	// solta não têm rota de edição (ficam só leitura na visão agrupada), então nunca chegam aqui.
	function openEntry(entry: { name: string; origin: string; groupKey: string | null }) {
		if (entry.origin === "task" && entry.groupKey) {
			navigate({
				to: "/tarefas/$taskId/$file",
				params: { taskId: entry.groupKey, file: entry.name },
			});
			return;
		}
		navigate({ to: "/vault/$fileName", params: { fileName: entry.name } });
	}

	if (!selectedProjectId) {
		return (
			<PageShell title="Vault" icon={Library}>
				<Text size="sm" tone="muted">
					Selecione um projeto para ver o vault.
				</Text>
			</PageShell>
		);
	}

	const selectedNames = [...selected];
	const isLoading = entriesQuery.isLoading;
	// Busca força o modo plano (resultados sobre nome+título), ignorando o toggle de agrupamento.
	const showFlat = grouping === "flat" || Boolean(search.trim());

	return (
		<PageShell
			title="Vault"
			icon={Library}
			description={`${looseCount} soltas · ${folderGroups.length} pastas · ${taskGroups.length} em tarefas de ${selectedProject?.name ?? "projeto"}`}
		>
			{isLoading ? (
				<div className="flex items-center gap-2 text-muted-foreground">
					<Loader2 size={16} className="animate-spin" />
					<Text size="sm" tone="muted">
						Carregando vault...
					</Text>
				</div>
			) : (
				<div className="relative flex h-full min-h-0 flex-col">
					<div className="mb-4 flex items-center gap-1">
						<div className="relative flex-1">
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
						<Divider />

						{!showFlat && (
							<>
								<Tooltip label="Colapsar tudo">
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										aria-label="Colapsar tudo"
										className="text-muted-foreground"
										onClick={collapseAllGroups}
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
										onClick={expandAllGroups}
									>
										<ChevronsUpDown className="size-4" />
									</Button>
								</Tooltip>
								<Divider />
							</>
						)}

						<Tooltip label="Agrupar por tarefa">
							<Button
								type="button"
								variant={grouping === "grouped" && !search.trim() ? "secondary" : "ghost"}
								size="icon-sm"
								aria-label="Agrupar por tarefa"
								aria-pressed={grouping === "grouped" && !search.trim()}
								className={cn(showFlat && "text-muted-foreground")}
								onClick={() => setGrouping("grouped")}
							>
								<ListTree className="size-4" />
							</Button>
						</Tooltip>
						<Tooltip label="Lista plana">
							<Button
								type="button"
								variant={showFlat ? "secondary" : "ghost"}
								size="icon-sm"
								aria-label="Lista plana"
								aria-pressed={showFlat}
								className={cn(!showFlat && "text-muted-foreground")}
								onClick={() => setGrouping("flat")}
							>
								<LayoutGrid className="size-4" />
							</Button>
						</Tooltip>

						<Divider />

						<VaultFilters filters={filters} onChange={setFilters} />
						<Tooltip label="Selecionar vários arquivos para vincular, mover ou soltar">
							<Button
								type="button"
								variant={organizing ? "secondary" : "ghost"}
								size="sm"
								onClick={toggleOrganizing}
								aria-pressed={organizing}
							>
								<CheckSquare className="size-4" />
								{organizing ? "Selecionando" : "Selecionar"}
							</Button>
						</Tooltip>
					</div>

					<div className="min-h-0 flex-1 overflow-y-auto pr-2">
						{showFlat ? (
							<VaultBrowser
								entries={filteredEntries}
								search={search}
								organizing={organizing}
								onOpen={openEntry}
								onSelect={selectEntry}
								isSelected={isEntrySelected}
								onCreateLoose={() => setCreatingTitle("")}
								onRenameLoose={(name) => setRenaming({ name, value: name })}
								onDeleteLoose={(name) => setDeleting(name)}
							/>
						) : (
							<VaultGroupedView
								entries={filteredEntries}
								taskGroups={visibleTaskGroups}
								folderGroups={visibleFolderGroups}
								collapsed={collapsed}
								organizing={organizing}
								onToggleCollapse={toggleCollapsed}
								onOpen={openEntry}
								onSelect={selectEntry}
								onSelectGroup={selectGroup}
								isSelected={isEntrySelected}
								onCreateLoose={() => setCreatingTitle("")}
								onRenameLoose={(name) => setRenaming({ name, value: name })}
								onDeleteLoose={(name) => setDeleting(name)}
								onAdoptFolder={(folderName) =>
									adoptFolderMutation.mutate({ projectId, folderName })
								}
								adoptingFolder={
									adoptFolderMutation.isPending
										? (adoptFolderMutation.variables?.folderName ?? null)
										: null
								}
							/>
						)}
					</div>

					{organizing && folderFiles.length > 0 && (
						<div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
							<div className="pointer-events-auto flex items-center gap-3 border border-border bg-card px-3 py-2 shadow-xl">
								<Text size="sm" className="font-mono tabular-nums">
									{folderFiles.length} de {activeFolderName}
								</Text>
								<LinkTaskPopover
									tasks={taskOptions}
									loading={tasksQuery.isLoading}
									fileNames={folderFiles.map((file) => file.name)}
									pending={moveFolderMutation.isPending || createTaskMutation.isPending}
									allowRename={false}
									verb="mover"
									onConfirm={(taskId) => moveFolderSelected(taskId)}
									onConfirmNew={(payload) => void moveFolderSelectedToNew(payload)}
								>
									<Button
										size="sm"
										disabled={moveFolderMutation.isPending || createTaskMutation.isPending}
									>
										{moveFolderMutation.isPending ? (
											<Loader2 size={14} className="animate-spin" />
										) : (
											<FolderInput size={14} />
										)}
										Mover para tarefa
									</Button>
								</LinkTaskPopover>
								<Button variant="ghost" size="sm" onClick={() => setFolderSelected(new Set())}>
									<X size={14} />
									Limpar
								</Button>
							</div>
						</div>
					)}

					{organizing && linkedFiles.length > 0 && (
						<div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
							<div className="pointer-events-auto flex items-center gap-3 border border-border bg-card px-3 py-2 shadow-xl">
								<Text size="sm" className="font-mono tabular-nums">
									{linkedFiles.length} vinculada{linkedFiles.length > 1 ? "s" : ""}
								</Text>
								<LinkTaskPopover
									tasks={taskOptions.filter((task) => !linkedSourceTaskIds.has(task.id))}
									loading={tasksQuery.isLoading}
									fileNames={linkedFiles.map((file) => file.name)}
									pending={moveMutation.isPending || createTaskMutation.isPending}
									allowRename={false}
									verb="mover"
									onConfirm={(taskId) => moveSelected(taskId)}
									onConfirmNew={(payload) => void moveSelectedToNew(payload)}
								>
									<Button size="sm" disabled={moveMutation.isPending || unlinkMutation.isPending}>
										{moveMutation.isPending ? (
											<Loader2 size={14} className="animate-spin" />
										) : (
											<FolderInput size={14} />
										)}
										Mover para tarefa
									</Button>
								</LinkTaskPopover>
								<Button
									variant="outline"
									size="sm"
									disabled={moveMutation.isPending || unlinkMutation.isPending}
									onClick={unlinkSelected}
								>
									{unlinkMutation.isPending ? (
										<Loader2 size={14} className="animate-spin" />
									) : (
										<Unlink size={14} />
									)}
									Soltar
								</Button>
								<Button variant="ghost" size="sm" onClick={() => setLinkedSelected(new Set())}>
									<X size={14} />
									Limpar
								</Button>
							</div>
						</div>
					)}

					{organizing && selectedNames.length > 0 && (
						<div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
							<div className="pointer-events-auto flex items-center gap-3 border border-border bg-card px-3 py-2 shadow-xl">
								<Text size="sm" className="font-mono tabular-nums">
									{selectedNames.length} selecionada{selectedNames.length > 1 ? "s" : ""}
								</Text>
								<LinkTaskPopover
									tasks={taskOptions}
									loading={tasksQuery.isLoading}
									fileNames={selectedNames}
									pending={linkMutation.isPending || createTaskMutation.isPending}
									onConfirm={linkSelected}
									onConfirmNew={(payload, targetName) =>
										void linkSelectedToNew(payload, targetName)
									}
								>
									<Button size="sm" disabled={linkMutation.isPending}>
										{linkMutation.isPending ? (
											<Loader2 size={14} className="animate-spin" />
										) : (
											<Link2 size={14} />
										)}
										Vincular a tarefa
									</Button>
								</LinkTaskPopover>
								<Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
									<X size={14} />
									Limpar
								</Button>
							</div>
						</div>
					)}
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
		</PageShell>
	);
}

function Divider() {
	return <div className="mx-1 h-5 w-px shrink-0 bg-border" />;
}
