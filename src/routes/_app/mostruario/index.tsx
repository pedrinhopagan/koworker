import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Loader2, Presentation } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { orpc, orpcWs } from "@/client";
import { PageShell } from "@/components/layout/page-shell";
import { Text, Title } from "@/components/typography";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { relativeTimeFrom } from "@/lib/relative-time";
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

function MostruarioPage() {
	const { selectedProjectId } = useProjectFocus();
	const queryClient = useQueryClient();

	const mostruarioQuery = useQuery({
		...orpc.mostruario.list.queryOptions({ input: { projectId: selectedProjectId } }),
		enabled: selectedProjectId !== null,
	});

	// Categoria, prioridade e feature vêm como id na tarefa; nome e cor moram nessas listas (mesmo
	// padrão do TaskItem). Já estão no cache do react-query pela página de Tarefas, então reler não
	// refaz fetch.
	const categoriesQuery = useQuery(orpc.categories.list.queryOptions());
	const prioritiesQuery = useQuery(orpc.priorities.list.queryOptions());
	const featuresQuery = useQuery({
		...orpc.taskGroups.list.queryOptions({ input: { projectId: selectedProjectId ?? "" } }),
		enabled: selectedProjectId !== null,
	});

	const categoriesById = new Map((categoriesQuery.data ?? []).map((c) => [c.id, c]));
	const prioritiesById = new Map((prioritiesQuery.data ?? []).map((p) => [p.id, p]));
	const featuresById = new Map((featuresQuery.data ?? []).map((f) => [f.id, f]));

	// Eventos de tasks (API, CLI ou watcher de FS) mudam quais tarefas têm artefatos e como aparecem;
	// o canal global só invalida `tasks`/`vault`, então a página cuida da própria key.
	useEffect(() => {
		const controller = new AbortController();

		async function subscribe() {
			try {
				const events = await orpcWs.tasks.call(undefined, { signal: controller.signal });
				for await (const _event of events) {
					queryClient.invalidateQueries({
						predicate: (query) =>
							Array.isArray(query.queryKey[0]) && query.queryKey[0][0] === "mostruario",
					});
				}
			} catch (error) {
				if (error instanceof Error && error.name === "AbortError") return;
				console.error("[Mostruário Realtime] Erro na subscription:", error);
			}
		}

		subscribe();

		return () => controller.abort();
	}, [queryClient]);

	const openMutation = useMutation({
		...orpc.tasks.openArtifact.mutationOptions(),
		onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao abrir"),
	});

	const tasks = mostruarioQuery.data ?? [];

	return (
		<PageShell
			icon={Presentation}
			title="Mostruário"
			description="Tarefas com apresentações e documentos (.html/.pdf) na pasta"
			contentClassName="min-h-0 flex-1 overflow-y-auto px-4 pb-10"
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
				<div className="flex flex-col gap-10">
					{tasks.map((task) => {
						const category = task.categoryId ? categoriesById.get(task.categoryId) : undefined;
						const priority = task.priorityId ? prioritiesById.get(task.priorityId) : undefined;
						const feature = task.groupId ? featuresById.get(task.groupId) : undefined;
						const artifacts = [...task.artifacts].sort((a, b) => b.mtime - a.mtime);

						return (
							<section key={task.id} className="flex flex-col gap-4">
								<header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
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

								<div className="h-px w-full bg-border" />

								<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
									{artifacts.map((artifact) => (
										<ArtifactCard
											key={artifact.name}
											artifact={artifact}
											onOpen={() => openMutation.mutate({ id: task.id, name: artifact.name })}
										/>
									))}
								</div>
							</section>
						);
					})}
				</div>
			)}
		</PageShell>
	);
}
