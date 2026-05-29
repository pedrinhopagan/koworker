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
import { LinkTaskPopover } from "./-components/link-task-popover";
import { linkedFileKey, VaultBrowser } from "./-components/vault-browser";

export const Route = createFileRoute("/_app/vault/")({
	component: VaultPage,
});

function VaultPage() {
	const { selectedProjectId, selectedProject } = useProjectFocus();
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	// Duas seleções mutuamente exclusivas: notas soltas (por nome) e arquivos já vinculados
	// (por taskId/name). Cada uma habilita ações diferentes, então mexer numa zera a outra.
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [linkedSelected, setLinkedSelected] = useState<Set<string>>(new Set());

	// Nota solta sob ação do menu de contexto: renomear abre um diálogo com input, deletar
	// abre a confirmação. Só uma fica ativa por vez.
	const [renaming, setRenaming] = useState<{ name: string; value: string } | null>(null);
	const [deleting, setDeleting] = useState<string | null>(null);

	useEffect(() => {
		setSelected(new Set());
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
	// listByProject não filtra `done`, então já traz as concluídas — o vault mostra os .md de
	// todas as tarefas, não só das pendentes.
	const tasksQuery = useQuery({
		...orpc.tasks.listByProject.queryOptions({ input: { projectId } }),
		enabled,
	});

	const loose = looseQuery.data ?? [];
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

	function toggleLinked(taskId: string, name: string) {
		setSelected(new Set());
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

	function unlinkSelected() {
		unlinkMutation.mutate({ projectId, files: linkedFiles });
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

	return (
		<PageShell
			title="Vault"
			icon={Library}
			description={`${loose.length} soltas · ${taskGroups.length} em tarefas de ${selectedProject?.name ?? "projeto"}`}
		>
			{looseQuery.isLoading || tasksQuery.isLoading ? (
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
							taskGroups={taskGroups}
							selected={selected}
							linkedSelected={linkedSelected}
							onToggleSelect={toggleSelect}
							onToggleLinked={toggleLinked}
							onOpen={(name) => navigate({ to: "/vault/$fileName", params: { fileName: name } })}
							onNavigateTask={(taskId) => navigate({ to: "/tarefas/$taskId", params: { taskId } })}
							onRenameLoose={(name) => setRenaming({ name, value: name })}
							onDeleteLoose={(name) => setDeleting(name)}
						/>
					</div>

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
									pending={moveMutation.isPending}
									allowRename={false}
									verb="mover"
									onConfirm={(taskId) => moveSelected(taskId)}
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
									pending={linkMutation.isPending}
									onConfirm={linkSelected}
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
