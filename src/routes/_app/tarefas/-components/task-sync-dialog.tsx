import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FolderSync, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { orpc, type RouterOutputs } from "@/client";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { invalidateTaskQueries } from "@/lib/task-query-invalidation";
import { TaskSyncRow, type TaskSyncDraft } from "./task-sync-row";

type Category = RouterOutputs["categories"]["list"][number];
type Priority = RouterOutputs["priorities"]["list"][number];

export function TaskSyncAction({
	projectId,
	categories,
	priorities,
}: {
	projectId: string | null;
	categories: Category[];
	priorities: Priority[];
}) {
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [drafts, setDrafts] = useState<TaskSyncDraft[]>([]);
	const discovery = useQuery({
		...orpc.tasks.discoverSync.queryOptions({ input: { projectId } }),
		enabled: open,
	});
	const mutation = useMutation({
		...orpc.tasks.createSync.mutationOptions(),
		onSuccess: async ({ created }) => {
			await invalidateTaskQueries(queryClient, { projectId });
			toast.success(
				`${created} tarefa${created === 1 ? "" : "s"} sincronizada${created === 1 ? "" : "s"}`,
			);
			setOpen(false);
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
				complexity: "medio",
				done: false,
			})),
		);
	}, [open, discovery.data]);

	const selected = drafts.filter((draft) => draft.selected);
	const invalidTitle = selected.some((draft) => !draft.title.trim());

	function handleSubmit() {
		mutation.mutate({
			tasks: selected.map((draft) => ({
				projectId: draft.projectId,
				folderName: draft.folderName,
				title: draft.title.trim(),
				categoryId: draft.categoryId,
				priorityId: draft.priorityId,
				complexity: draft.complexity,
				done: draft.done,
			})),
		});
	}

	function handleOpen() {
		mutation.reset();
		setOpen(true);
	}

	return (
		<>
			<Button type="button" variant="outline" size="sm" onClick={handleOpen}>
				<RefreshCw className="size-4" />
				Sincronizar
			</Button>

			<Dialog
				open={open}
				onClose={() => !mutation.isPending && setOpen(false)}
				title="Sincronizar tarefas"
				description={
					projectId
						? "Pastas do projeto ainda ausentes no banco"
						: "Pastas de todos os projetos ainda ausentes no banco"
				}
				className="max-w-4xl"
				footer={
					<>
						<Button
							type="button"
							variant="ghost"
							disabled={mutation.isPending}
							onClick={() => setOpen(false)}
						>
							Cancelar
						</Button>
						<Button
							type="button"
							disabled={
								mutation.isPending || selected.length === 0 || invalidTitle || discovery.isLoading
							}
							onClick={handleSubmit}
						>
							{mutation.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<CheckCircle2 className="size-4" />
							)}
							{mutation.isPending
								? "Criando..."
								: `Criar ${selected.length} tarefa${selected.length === 1 ? "" : "s"}`}
						</Button>
					</>
				}
			>
				{discovery.isLoading && (
					<div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
						<Loader2 className="size-4 animate-spin" />
						Lendo pastas .koworker...
					</div>
				)}

				{discovery.isError && (
					<EmptyFeedback
						icon={FolderSync}
						title="Não foi possível ler as tarefas"
						subtitle="Confira se a pasta do projeto ainda está acessível."
					/>
				)}

				{discovery.isSuccess && drafts.length === 0 && (
					<EmptyFeedback
						icon={CheckCircle2}
						title="Tudo sincronizado"
						subtitle="Nenhuma pasta de tarefa nova foi encontrada."
					/>
				)}

				{drafts.length > 0 && (
					<div className="grid gap-3">
						<div className="flex items-center justify-between gap-3">
							<Text size="xs" tone="muted">
								{selected.length} de {drafts.length} selecionadas
							</Text>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								disabled={mutation.isPending}
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
								disabled={mutation.isPending}
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
			</Dialog>
		</>
	);
}
