import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Loader2, Presentation } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { FileContextMenu } from "@/components/file-context-menu";
import { PageShell } from "@/components/layout/page-shell";
import { Text, Title } from "@/components/typography";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { joinPath, openFolderInOs } from "@/lib/os-share";
import { relativeTimeFrom } from "@/lib/relative-time";
import { invalidateTaskQueries } from "@/lib/task-query-invalidation";
import { cn } from "@/lib/utils";
import { ArtifactCard } from "./-components/artifact-card";

export const Route = createFileRoute("/_app/mostruario/")({
	component: MostruarioPage,
});

// Chip de metadado da tarefa: dot colorido + nome, igual à listagem de tarefas. Feature, categoria e
// prioridade compartilham o mesmo formato ({ name, color }), então um só componente serve os três.
function MetaChip({ color, label }: { color: string; label: string }) {
	return (
		<span className="inline-flex shrink-0 items-center gap-1.5 border border-border px-1.5 py-0.5 text-muted-foreground text-xs">
			<span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
			{label}
		</span>
	);
}

type ArtifactRef = {
	taskId: string;
	name: string;
};

function MostruarioPage() {
	const { selectedProjectId } = useProjectFocus();
	const queryClient = useQueryClient();
	const projectInput = selectedProjectId ? { projectId: selectedProjectId } : {};

	const [renaming, setRenaming] = useState<ArtifactRef | null>(null);
	const [renameValue, setRenameValue] = useState("");
	const [deleting, setDeleting] = useState<ArtifactRef | null>(null);

	const mostruarioQuery = useQuery({
		...orpc.mostruario.list.queryOptions({ input: projectInput }),
		enabled: selectedProjectId !== null,
	});

	// Categoria, prioridade e feature vêm como id na tarefa; nome e cor moram nessas listas (mesmo
	// padrão do TaskItem). Já estão no cache do react-query pela página de Tarefas, então reler não
	// refaz fetch.
	const categoriesQuery = useQuery(orpc.categories.list.queryOptions());
	const prioritiesQuery = useQuery(orpc.priorities.list.queryOptions());
	const featuresQuery = useQuery({
		...orpc.taskGroups.list.queryOptions({ input: projectInput }),
		enabled: selectedProjectId !== null,
	});

	const categoriesById = useMemo(
		() => new Map((categoriesQuery.data ?? []).map((category) => [category.id, category])),
		[categoriesQuery.data],
	);
	const prioritiesById = useMemo(
		() => new Map((prioritiesQuery.data ?? []).map((priority) => [priority.id, priority])),
		[prioritiesQuery.data],
	);
	const featuresById = useMemo(
		() => new Map((featuresQuery.data ?? []).map((feature) => [feature.id, feature])),
		[featuresQuery.data],
	);

	const projectsQuery = useQuery(orpc.projects.list.queryOptions());
	const projectsById = useMemo(
		() => new Map((projectsQuery.data ?? []).map((project) => [project.id, project])),
		[projectsQuery.data],
	);

	const openMutation = useMutation({
		...orpc.tasks.openArtifact.mutationOptions(),
		onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao abrir"),
	});

	const renameFileMutation = useMutation({
		...orpc.tasks.renameFile.mutationOptions(),
		onSuccess: (_result, variables) => {
			void invalidateTaskQueries(queryClient, {
				taskId: variables.id,
				projectId: mostruarioQuery.data?.find((task) => task.id === variables.id)?.projectId,
			});
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao renomear"),
	});

	const deleteFileMutation = useMutation({
		...orpc.tasks.deleteFile.mutationOptions(),
		onSuccess: (_result, variables) => {
			void invalidateTaskQueries(queryClient, {
				taskId: variables.id,
				projectId: mostruarioQuery.data?.find((task) => task.id === variables.id)?.projectId,
			});
			setDeleting(null);
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao deletar"),
	});

	const confirmRename = () => {
		const newName = renameValue.trim();
		if (!renaming || !newName || newName === renaming.name) {
			setRenaming(null);
			return;
		}

		const ext = renaming.name.slice(renaming.name.lastIndexOf("."));
		if (!newName.endsWith(ext)) {
			toast.error(`O nome deve terminar em ${ext}`);
			return;
		}

		renameFileMutation.mutate({ id: renaming.taskId, oldName: renaming.name, newName });
		setRenaming(null);
	};

	const tasks = mostruarioQuery.data ?? [];

	return (
		<PageShell
			icon={Presentation}
			title="Mostruário"
			description="Tarefas com apresentações e documentos (.html/.pdf) na pasta"
			contentClassName="min-h-0 flex-1 overflow-y-auto px-4 pb-12"
		>
			{mostruarioQuery.isLoading ? (
				<div className="flex h-full items-center justify-center">
					<Loader2 size={18} className="animate-spin text-muted-foreground" />
				</div>
			) : tasks.length === 0 ? (
				<div className="flex h-full flex-col items-center justify-center gap-3">
					<span className="flex size-12 items-center justify-center border border-border text-muted-foreground">
						<Presentation size={20} />
					</span>
					<Text size="sm" tone="muted">
						Nenhuma tarefa com artefatos (.html/.pdf).
					</Text>
				</div>
			) : (
				<div className="mx-auto flex w-full max-w-7xl flex-col gap-12">
					{tasks.map((task) => {
						const category = task.categoryId ? categoriesById.get(task.categoryId) : undefined;
						const priority = task.priorityId ? prioritiesById.get(task.priorityId) : undefined;
						const feature = task.groupId ? featuresById.get(task.groupId) : undefined;
						const mainRoute = projectsById.get(task.projectId)?.mainRoute;
						return (
							<section key={task.id} className="flex flex-col gap-5">
								<header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-border pb-3">
									<div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
										{task.done && (
											<span className="flex size-4 shrink-0 items-center justify-center border border-border bg-secondary/40 text-muted-foreground">
												<Check size={11} />
											</span>
										)}
										<Link
											to="/tarefas/$taskId"
											params={{ taskId: task.id }}
											className="min-w-0 shrink"
										>
											<Title
												as="span"
												size="sm"
												className={cn(
													"block truncate font-normal tracking-wide transition-colors hover:text-foreground",
													task.done ? "text-muted-foreground line-through" : "text-foreground",
												)}
											>
												{task.displayTitle}
											</Title>
										</Link>
										{feature && <MetaChip color={feature.color} label={feature.name} />}
										{category && <MetaChip color={category.color} label={category.name} />}
										{priority && <MetaChip color={priority.color} label={priority.name} />}
									</div>
									<Text size="xs" tone="muted" className="shrink-0 tabular-nums">
										{relativeTimeFrom(task.lastEditedAt)}
									</Text>
								</header>

								<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
									{task.artifacts.map((artifact) => (
										<FileContextMenu
											key={artifact.name}
											name={artifact.name}
											path={`${task.folderPath}/${artifact.name}`}
											absolutePath={
												mainRoute
													? joinPath(mainRoute, `${task.folderPath}/${artifact.name}`)
													: undefined
											}
											onOpenFolder={
												mainRoute
													? () => void openFolderInOs(joinPath(mainRoute, task.folderPath))
													: undefined
											}
											onRename={() => {
												setRenaming({ taskId: task.id, name: artifact.name });
												setRenameValue(artifact.name);
											}}
											onDelete={() => setDeleting({ taskId: task.id, name: artifact.name })}
										>
											<ArtifactCard
												artifact={artifact}
												onOpen={() => openMutation.mutate({ id: task.id, name: artifact.name })}
											/>
										</FileContextMenu>
									))}
								</div>
							</section>
						);
					})}
				</div>
			)}

			<ConfirmDialog
				open={renaming !== null}
				onClose={() => setRenaming(null)}
				onConfirm={confirmRename}
				title="Renomear arquivo"
				confirmLabel="Renomear"
				loading={renameFileMutation.isPending}
			>
				<Input
					// biome-ignore lint/a11y/noAutofocus: foco natural ao abrir o diálogo de renomear.
					autoFocus
					value={renameValue}
					onChange={(e) => setRenameValue(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							confirmRename();
						}
					}}
					placeholder="apresentacao.html"
				/>
			</ConfirmDialog>

			<ConfirmDialog
				open={deleting !== null}
				onClose={() => setDeleting(null)}
				onConfirm={() =>
					deleting && deleteFileMutation.mutate({ id: deleting.taskId, name: deleting.name })
				}
				title="Deletar arquivo"
				description={
					deleting ? `“${deleting.name}” será apagado permanentemente do disco.` : undefined
				}
				confirmLabel="Deletar"
				variant="danger"
				loading={deleteFileMutation.isPending}
			/>
		</PageShell>
	);
}
