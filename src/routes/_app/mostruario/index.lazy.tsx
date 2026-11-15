import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, Loader2, Presentation, Search, WifiOff } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "@/components/ui/toast";

import { orpc } from "@/client";
import { FileContextMenu } from "@/components/file-context-menu";
import { PageShell } from "@/components/layout/page-shell";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { Input } from "@/components/ui/input";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { joinPath, openFolderInOs } from "@/lib/os-share";
import { relativeTimeFrom } from "@/lib/relative-time";
import { invalidateTaskQueries } from "@/lib/task-query-invalidation";
import { cn } from "@/lib/utils";
import { ArtifactCard } from "./-components/artifact-card";

export const Route = createLazyFileRoute("/_app/mostruario/")({
	component: MostruarioPage,
});

// Chip de metadado da tarefa: dot colorido + nome, igual à listagem de tarefas. Feature, categoria e
// prioridade compartilham o mesmo formato ({ name, color }), então um só componente serve os três.
function MetaChip({ color, label }: { color: string; label: string }) {
	return (
		<span className="inline-flex shrink-0 items-center gap-1.5 border border-border px-1.5 py-0.5 text-muted-foreground text-xs">
			<span className="size-2 shrink-0" style={{ backgroundColor: color }} />
			{label}
		</span>
	);
}

type ArtifactRef = {
	taskId: string;
	name: string;
};

function MostruarioPage() {
	const navigate = useNavigate();
	const { selectedProjectId } = useProjectFocus();
	const queryClient = useQueryClient();
	const projectInput = selectedProjectId ? { projectId: selectedProjectId } : {};

	const [search, setSearch] = useState("");
	const [searchDraft, setSearchDraft] = useDebouncedSearch(search, setSearch);
	const [searchAllProjects, setSearchAllProjects] = useState(true);
	const query = search.trim();

	const [renaming, setRenaming] = useState<ArtifactRef | null>(null);
	const [renameValue, setRenameValue] = useState("");
	const [deleting, setDeleting] = useState<ArtifactRef | null>(null);

	const {
		data: mostruarioTasks,
		isFetching,
		isLoading,
		isError,
		refetch,
	} = useQuery(
		orpc.mostruario.list.queryOptions({
			input: { ...(query && searchAllProjects ? {} : projectInput), query },
			enabled: selectedProjectId !== null || !!query,
			gcTime: 60_000,
		}),
	);

	// Categoria, prioridade e feature vêm como id na tarefa; nome e cor moram nessas listas (mesmo
	// padrão do TaskItem). Já estão no cache do react-query pela página de Tarefas, então reler não
	// refaz fetch.
	const featuresQuery = useQuery(
		orpc.taskGroups.list.queryOptions({
			input: query && searchAllProjects ? {} : projectInput,
			enabled: selectedProjectId !== null,
		}),
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
				projectId: mostruarioTasks?.find((task) => task.id === variables.id)?.projectId,
			});
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao renomear"),
	});

	const deleteFileMutation = useMutation({
		...orpc.tasks.deleteFile.mutationOptions(),
		onSuccess: (_result, variables) => {
			void invalidateTaskQueries(queryClient, {
				taskId: variables.id,
				projectId: mostruarioTasks?.find((task) => task.id === variables.id)?.projectId,
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

	const tasks = mostruarioTasks ?? [];
	const searching = searchDraft.trim() !== query || isFetching;
	const artifactCount = tasks.reduce((total, task) => total + task.artifacts.length, 0);

	return (
		<PageShell
			icon={Presentation}
			title="Mostruário"
			description="Vídeos, áudios, apresentações e documentos das tarefas"
			contentClassName="min-h-0 flex-1 overflow-y-auto px-4 pb-12"
		>
			<div className="mx-auto mb-8 flex w-full max-w-7xl flex-col gap-3">
				<label htmlFor="mostruario-search" className="text-sm font-medium">
					Buscar no Mostruário
				</label>
				<div className="flex items-center gap-2">
					<div className="relative flex-1">
						<Search
							size={16}
							className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
						/>
						<Input
							id="mostruario-search"
							type="search"
							value={searchDraft}
							maxLength={200}
							onChange={(event) => setSearchDraft(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Escape") {
									setSearchDraft("");
									setSearch("");
								}
							}}
							placeholder="Ex.: comparação de planos, onboarding, arquitetura"
							aria-describedby="mostruario-search-help"
							className="pl-9"
						/>
					</div>
					{!!searchDraft && (
						<Button
							variant="ghost"
							onClick={() => {
								setSearchDraft("");
								setSearch("");
							}}
						>
							Limpar
						</Button>
					)}
				</div>
				<Text id="mostruario-search-help" size="xs" tone="muted">
					Busca no conteúdo dos HTMLs, nos títulos e nos nomes. Ignora diferenças de acento e aceita
					palavras incompletas e pequenos erros.
				</Text>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
						<Checkbox
							checked={searchAllProjects}
							onCheckedChange={(checked) => setSearchAllProjects(checked === true)}
						/>
						Buscar em todos os projetos
					</label>
					<div
						role="status"
						aria-live="polite"
						className="flex items-center gap-2 text-xs text-muted-foreground"
					>
						{searching && <Loader2 size={14} className="animate-spin" />}
						{searching && "Buscando…"}
						{!searching &&
							!!query &&
							!isError &&
							`${artifactCount} arquivo(s) encontrado(s) · por relevância`}
					</div>
				</div>
			</div>
			{isLoading ? (
				<div className="flex h-full items-center justify-center">
					<Loader2 size={18} className="animate-spin text-muted-foreground" />
				</div>
			) : isError ? (
				<EmptyFeedback
					icon={WifiOff}
					title="Não foi possível carregar o mostruário"
					subtitle="Verifique a conexão com o servidor."
					actionText="Tentar de novo"
					onAction={() => void refetch()}
				/>
			) : tasks.length === 0 && query ? (
				<EmptyFeedback
					icon={Search}
					title="Nenhum arquivo encontrado"
					subtitle="Tente palavras mais específicas ou busque em todos os projetos. PDFs são pesquisados apenas pelo nome e pela tarefa."
					actionText="Limpar busca"
					onAction={() => {
						setSearchDraft("");
						setSearch("");
					}}
				/>
			) : tasks.length === 0 ? (
				<div className="flex h-full flex-col items-center justify-center gap-3">
					<span className="flex size-12 items-center justify-center border border-border text-muted-foreground">
						<Presentation size={20} />
					</span>
					<Text size="sm" tone="muted">
						Nenhuma tarefa com vídeos, áudios, apresentações ou documentos.
					</Text>
				</div>
			) : (
				<div aria-busy={searching} className="mx-auto flex w-full max-w-7xl flex-col gap-12">
					{tasks.map((task) => {
						const feature = task.groupId ? featuresById.get(task.groupId) : undefined;
						const project = projectsById.get(task.projectId);
						const mainRoute = project?.mainRoute;
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
										{!!query && searchAllProjects && project && (
											<MetaChip color={project.color} label={project.name} />
										)}
										{feature && <MetaChip color={feature.color} label={feature.name} />}
									</div>
									<Text size="xs" tone="muted" className="shrink-0 tabular-nums">
										{relativeTimeFrom(task.lastEditedAt)}
									</Text>
								</header>

								<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
									{task.artifacts.map((artifact) => {
										const path = mainRoute
											? joinPath(mainRoute, `${task.folderPath}/${artifact.name}`)
											: undefined;

										return (
											<FileContextMenu
												key={artifact.name}
												name={artifact.name}
												path={`${task.folderPath}/${artifact.name}`}
												absolutePath={path}
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
													path={path}
													onOpen={(event) => {
														if (event.altKey || !path) {
															openMutation.mutate({ id: task.id, name: artifact.name });
															return;
														}
														void navigate({
															to: "/arquivo",
															search: { path },
														});
													}}
													onAuxClick={(event) => {
														if (event.button === 1) {
															event.preventDefault();
															openMutation.mutate({ id: task.id, name: artifact.name });
														}
													}}
												/>
											</FileContextMenu>
										);
									})}
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
