import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FolderInput, Library, Link2, Loader2, Unlink, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { PageShell } from "@/components/layout/page-shell";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { LinkTaskPopover, type NewTaskPayload } from "./-components/link-task-popover";
import { folderFileKey, linkedFileKey, VaultBrowser } from "./-components/vault-browser";

export const Route = createFileRoute("/_app/vault/")({
	component: VaultPage,
});

function VaultPage() {
	const { selectedProjectId, selectedProject } = useProjectFocus();
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	// Três seleções mutuamente exclusivas: notas soltas (por nome), arquivos dentro de uma pasta
	// solta (por pasta/nome) e arquivos já vinculados a tarefas (por taskId/nome). Cada uma habilita
	// ações diferentes, então mexer numa zera as outras.
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [folderSelected, setFolderSelected] = useState<Set<string>>(new Set());
	const [linkedSelected, setLinkedSelected] = useState<Set<string>>(new Set());

	// Nota solta sob ação do menu de contexto: renomear abre um diálogo com input, deletar
	// abre a confirmação. Só uma fica ativa por vez.
	const [renaming, setRenaming] = useState<{ name: string; value: string } | null>(null);
	const [deleting, setDeleting] = useState<string | null>(null);

	// Pasta solta sendo adotada como tarefa: trava os botões de adoção enquanto a request corre.
	const [adoptingFolder, setAdoptingFolder] = useState<string | null>(null);

	useEffect(() => {
		setSelected(new Set());
		setFolderSelected(new Set());
		setLinkedSelected(new Set());
		setRenaming(null);
		setDeleting(null);
	}, [selectedProjectId]);

	const projectId = selectedProjectId ?? "";
	const enabled = Boolean(selectedProjectId);

	const looseQuery = useQuery({
		...orpc.vault.list.queryOptions({ input: { projectId } }),
		enabled,
	});
	const foldersQuery = useQuery({
		...orpc.vault.listFolders.queryOptions({ input: { projectId } }),
		enabled,
	});
	// listByProject não filtra `done`, então já traz as concluídas — o vault mostra os .md de
	// todas as tarefas, não só das pendentes.
	const tasksQuery = useQuery({
		...orpc.tasks.listByProject.queryOptions({ input: { projectId } }),
		enabled,
	});

	const loose = looseQuery.data ?? [];
	const folders = foldersQuery.data ?? [];
	const allTasks = tasksQuery.data ?? [];
	const taskGroups = useMemo(
		() =>
			allTasks
				.filter((task) => task.fileNames.length > 0)
				.map((task) => ({
					taskId: task.id,
					displayTitle: task.displayTitle,
					fileNames: task.fileNames,
				})),
		[allTasks],
	);
	const taskOptions = useMemo(
		() => allTasks.map((task) => ({ id: task.id, displayTitle: task.displayTitle })),
		[allTasks],
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

	const adoptMutation = useMutation({
		...orpc.vault.adoptFolder.mutationOptions(),
		onSuccess: async (result) => {
			await invalidateVaultAndTasks();
			setAdoptingFolder(null);
			toast.success("Pasta transformada em tarefa");
			navigate({ to: "/tarefas/$taskId", params: { taskId: result.id } });
		},
		onError: (err) => {
			setAdoptingFolder(null);
			toast.error(err instanceof Error ? err.message : "Não foi possível transformar a pasta");
		},
	});

	const createTaskMutation = useMutation(orpc.tasks.create.mutationOptions());

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

	function toggleSelect(name: string) {
		setFolderSelected(new Set());
		setLinkedSelected(new Set());
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(name)) {
				next.delete(name);
			} else {
				next.add(name);
			}
			return next;
		});
	}

	// A seleção de arquivos da pasta solta é por pasta: o move manda um único folderName. Marcar um
	// arquivo de outra pasta recomeça a seleção naquela pasta, em vez de misturar origens.
	function toggleFolderFile(folderName: string, name: string) {
		setSelected(new Set());
		setLinkedSelected(new Set());
		const key = folderFileKey(folderName, name);
		setFolderSelected((prev) => {
			if (prev.has(key)) {
				const next = new Set(prev);
				next.delete(key);
				return next;
			}
			const sameFolder = [...prev].every((k) => k.startsWith(`${folderName}/`));
			const next = sameFolder ? new Set(prev) : new Set<string>();
			next.add(key);
			return next;
		});
	}

	function toggleLinked(taskId: string, name: string) {
		setSelected(new Set());
		setFolderSelected(new Set());
		setLinkedSelected((prev) => {
			const next = new Set(prev);
			const key = linkedFileKey(taskId, name);
			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}
			return next;
		});
	}

	function adoptFolder(folderName: string) {
		setAdoptingFolder(folderName);
		adoptMutation.mutate({ projectId, folderName });
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
	const isLoading = looseQuery.isLoading || foldersQuery.isLoading || tasksQuery.isLoading;

	return (
		<PageShell
			title="Vault"
			icon={Library}
			description={`${loose.length} soltas · ${folders.length} pastas · ${taskGroups.length} em tarefas de ${selectedProject?.name ?? "projeto"}`}
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
					<div className="min-h-0 flex-1 overflow-y-auto pr-2">
						<VaultBrowser
							loose={loose}
							folders={folders}
							taskGroups={taskGroups}
							selected={selected}
							folderSelected={folderSelected}
							linkedSelected={linkedSelected}
							onToggleSelect={toggleSelect}
							onToggleFolderFile={toggleFolderFile}
							onToggleLinked={toggleLinked}
							onAdoptFolder={adoptFolder}
							adoptingFolder={adoptingFolder}
							onOpen={(name) => navigate({ to: "/vault/$fileName", params: { fileName: name } })}
							onNavigateTask={(taskId) => navigate({ to: "/tarefas/$taskId", params: { taskId } })}
							onRenameLoose={(name) => setRenaming({ name, value: name })}
							onDeleteLoose={(name) => setDeleting(name)}
						/>
					</div>

					{folderFiles.length > 0 && (
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

					{linkedFiles.length > 0 && (
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

					{selectedNames.length > 0 && (
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
