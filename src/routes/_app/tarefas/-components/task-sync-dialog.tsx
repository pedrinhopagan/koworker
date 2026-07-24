import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, DatabaseBackup, FolderSync, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { orpc, type RouterOutputs } from "@/client";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { invalidateTaskQueries } from "@/lib/task-query-invalidation";
import { TaskStoragePreview } from "./task-storage-preview";
import { TaskSyncRow, type TaskSyncDraft } from "./task-sync-row";

type Category = RouterOutputs["categories"]["list"][number];
type Priority = RouterOutputs["priorities"]["list"][number];
type Feature = RouterOutputs["taskGroups"]["list"][number];

export function TaskSyncAction({
	projectId,
	categories,
	priorities,
	features,
}: {
	projectId: string | null;
	categories: Category[];
	priorities: Priority[];
	features: Feature[];
}) {
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [drafts, setDrafts] = useState<TaskSyncDraft[]>([]);
	const discovery = useQuery({
		...orpc.tasks.discoverSync.queryOptions({ input: { projectId } }),
		enabled: open && Boolean(projectId),
	});
	const preview = useQuery({
		...orpc.taskStorage.preview.queryOptions({ input: { projectId: projectId ?? "" } }),
		enabled: open && Boolean(projectId),
	});
	const release = useQuery({
		...orpc.system.version.queryOptions(),
		enabled: open,
	});
	const latestRun = useQuery({
		...orpc.taskStorage.getLatest.queryOptions({ input: { projectId: projectId ?? "" } }),
		enabled: open && Boolean(projectId),
	});
	const mutation = useMutation({
		...orpc.tasks.createSync.mutationOptions(),
		onSuccess: async ({ created }) => {
			await Promise.all([
				invalidateTaskQueries(queryClient, { projectId }),
				discovery.refetch(),
				preview.refetch(),
			]);
			toast.success(
				`${created} tarefa${created === 1 ? "" : "s"} sincronizada${created === 1 ? "" : "s"}`,
			);
		},
	});
	const applyMutation = useMutation({
		...orpc.taskStorage.apply.mutationOptions(),
		onSuccess: async () => {
			await Promise.all([
				invalidateTaskQueries(queryClient, { projectId }),
				preview.refetch(),
				latestRun.refetch(),
			]);
			toast.success("Storage reconciliado e verificado");
		},
		onError: async () => {
			await latestRun.refetch();
		},
	});
	const resumeMutation = useMutation({
		...orpc.taskStorage.resume.mutationOptions(),
		onSuccess: async () => {
			await Promise.all([preview.refetch(), latestRun.refetch()]);
			toast.success("Reconciliação retomada e verificada");
		},
	});
	const rollbackMutation = useMutation({
		...orpc.taskStorage.rollback.mutationOptions(),
		onSuccess: async () => {
			await Promise.all([preview.refetch(), latestRun.refetch()]);
			toast.success("Layout anterior restaurado sem apagar o backup");
		},
	});

	useEffect(() => {
		if (!discovery.data) {
			return;
		}

		setDrafts(
			discovery.data.map((task) => ({
				...task,
				selected: true,
				groupId: "",
				complexity: "medio",
				done: false,
			})),
		);
	}, [open, discovery.data]);

	const selected = drafts.filter((draft) => draft.selected);
	const invalidTitle = selected.some((draft) => !draft.title.trim());
	const invalidFeature = selected.some((draft) => !draft.groupId);

	function handleSubmit() {
		mutation.mutate({
			tasks: selected.map((draft) => ({
				projectId: draft.projectId,
				folderName: draft.folderName,
				title: draft.title.trim(),
				groupId: draft.groupId,
				categoryId: draft.categoryId,
				priorityId: draft.priorityId,
				complexity: draft.complexity,
				done: draft.done,
			})),
		});
	}

	function handleOpen() {
		mutation.reset();
		applyMutation.reset();
		setOpen(true);
	}

	function handleApply() {
		if (!projectId || !preview.data) return;
		applyMutation.mutate({
			projectId,
			planHash: preview.data.planHash,
			confirmed: true,
		});
	}

	const pending =
		mutation.isPending ||
		applyMutation.isPending ||
		resumeMutation.isPending ||
		rollbackMutation.isPending;
	const journal = latestRun.data;
	const needsApply =
		!!preview.data &&
		(preview.data.totals.toApply > 0 ||
			preview.data.fromLayoutVersion !== preview.data.toLayoutVersion);

	return (
		<>
			<Button type="button" variant="outline" size="sm" disabled={!projectId} onClick={handleOpen}>
				<RefreshCw className="size-4" />
				Reconciliar arquivos
			</Button>

			<Dialog
				open={open}
				onClose={() => !pending && setOpen(false)}
				title="Reconciliar arquivos"
				description="Diagnóstico verificável do projeto selecionado"
				className="max-w-4xl"
				footer={
					<>
						<Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
							Cancelar
						</Button>
						{selected.length > 0 && (
							<Button
								type="button"
								variant="outline"
								disabled={pending || invalidTitle || invalidFeature || discovery.isLoading}
								onClick={handleSubmit}
							>
								{mutation.isPending ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									<CheckCircle2 className="size-4" />
								)}
								{mutation.isPending
									? "Importando..."
									: `Importar ${selected.length} pasta${selected.length === 1 ? "" : "s"}`}
							</Button>
						)}
						{needsApply && (
							<Button
								type="button"
								disabled={
									pending ||
									preview.data.totals.blocked > 0 ||
									preview.data.totals.orphaned > 0 ||
									!release.data?.compatible
								}
								onClick={handleApply}
							>
								{applyMutation.isPending ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									<DatabaseBackup className="size-4" />
								)}
								{applyMutation.isPending ? "Sincronizando..." : "Sincronizar agora"}
							</Button>
						)}
					</>
				}
			>
				{(discovery.isLoading || preview.isLoading) && (
					<div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
						<Loader2 className="size-4 animate-spin" />
						Calculando hashes e conferindo o storage...
					</div>
				)}

				{(discovery.isError || preview.isError) && (
					<EmptyFeedback
						icon={FolderSync}
						title="Não foi possível diagnosticar o storage"
						subtitle="Confira se a pasta do projeto ainda está acessível."
					/>
				)}

				{preview.data && <TaskStoragePreview plan={preview.data} />}

				{release.data && !release.data.compatible && (
					<Text size="xs" tone="destructive" className="mt-4">
						Apply desabilitado: backend {release.data.storageRelease} e CLI instalada{" "}
						{release.data.cliRelease ?? "ausente"} não pertencem à mesma release.
					</Text>
				)}

				{journal && journal.status !== "completed" && journal.status !== "rolled_back" && (
					<div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-border bg-card p-4">
						<div>
							<Text className="font-medium">Journal {journal.status}</Text>
							<Text size="xs" tone="muted" className="mt-0.5 font-mono">
								{journal.id}
							</Text>
							{journal.error && (
								<Text size="xs" tone="destructive" className="mt-1">
									{journal.error}
								</Text>
							)}
						</div>
						<div className="flex gap-2">
							<Button
								type="button"
								variant="outline"
								disabled={pending}
								onClick={() => rollbackMutation.mutate({ runId: journal.id })}
							>
								Rollback
							</Button>
							<Button
								type="button"
								disabled={pending}
								onClick={() => resumeMutation.mutate({ runId: journal.id })}
							>
								Retomar
							</Button>
						</div>
					</div>
				)}

				{drafts.length > 0 && (
					<div className="mt-6 grid gap-3 border-t border-border pt-5">
						<div className="flex items-center justify-between gap-3">
							<div>
								<Text className="font-medium">Importar pastas órfãs</Text>
								<Text size="xs" tone="muted">
									{selected.length} de {drafts.length} selecionadas
								</Text>
							</div>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								disabled={pending}
								onClick={() =>
									setDrafts((current) =>
										current.map((draft) => ({
											...draft,
											selected: selected.length !== drafts.length,
										})),
									)
								}
							>
								{selected.length === drafts.length ? "Desmarcar todas" : "Selecionar todas"}
							</Button>
						</div>

						{drafts.map((draft, index) => (
							<TaskSyncRow
								key={`${draft.projectId}:${draft.folderName}`}
								draft={draft}
								categories={categories}
								priorities={priorities}
								features={features.filter((feature) => feature.projectId === draft.projectId)}
								disabled={pending}
								onChange={(updates) =>
									setDrafts((current) =>
										current.map((item, itemIndex) =>
											itemIndex === index ? { ...item, ...updates } : item,
										),
									)
								}
							/>
						))}

						{mutation.isError && (
							<Text size="xs" tone="destructive">
								{mutation.error instanceof Error
									? mutation.error.message
									: "Não foi possível sincronizar as tarefas"}
							</Text>
						)}
					</div>
				)}

				{applyMutation.isError && (
					<Text size="xs" tone="destructive" className="mt-4">
						{applyMutation.error instanceof Error
							? applyMutation.error.message
							: "Não foi possível aplicar o plano"}
					</Text>
				)}
			</Dialog>
		</>
	);
}
