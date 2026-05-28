import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Library, Link2, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { PageShell } from "@/components/layout/page-shell";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { LinkTaskPopover } from "./-components/link-task-popover";
import { VaultBrowser } from "./-components/vault-browser";

export const Route = createFileRoute("/_app/vault/")({
	component: VaultPage,
});

function VaultPage() {
	const { selectedProjectId, selectedProject } = useProjectFocus();
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const [selected, setSelected] = useState<Set<string>>(new Set());

	useEffect(() => {
		setSelected(new Set());
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

	const linkMutation = useMutation({
		...orpc.vault.linkToTask.mutationOptions(),
		onSuccess: async (result) => {
			await queryClient.invalidateQueries({
				predicate: (query) =>
					Array.isArray(query.queryKey[0]) &&
					(query.queryKey[0][0] === "tasks" || query.queryKey[0][0] === "vault"),
			});
			toast.success(
				result.count === 1
					? "Nota arquivada na tarefa"
					: `${result.count} notas arquivadas na tarefa`,
			);
			setSelected(new Set());
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Não foi possível vincular"),
	});

	function toggleSelect(name: string) {
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
							onToggleSelect={toggleSelect}
							onOpen={(name) => navigate({ to: "/vault/$fileName", params: { fileName: name } })}
							onNavigateTask={(taskId) => navigate({ to: "/tarefas/$taskId", params: { taskId } })}
						/>
					</div>

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
		</PageShell>
	);
}
