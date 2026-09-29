import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FolderOpen, Gauge, GitBranch, Pencil, Search, SquareTerminal } from "lucide-react";
import { useState } from "react";

import { orpc } from "@/client";
import { PageShell } from "@/components/layout/page-shell";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PROJECT_ACTION_GROUP_LABELS, PROJECT_ACTION_GROUPS } from "@/constants/project-actions";
import { useProjectFocus } from "@/hooks";
import { useCapabilities } from "@/hooks/use-capabilities";
import { openFolderInOs } from "@/lib/os-share";
import { openProjectTerminal } from "@/lib/terminal";
import { ActionActivity } from "./-components/action-activity";
import { ActionTile } from "./-components/action-tile";
import { useActionRuns } from "./-utils/use-action-runs";

export const Route = createFileRoute("/_app/painel/$projetoId")({
	beforeLoad: ({ params }) => ({ routeProjectId: params.projetoId }),
	component: PainelPage,
});

function PainelPage() {
	const { projetoId } = Route.useParams();
	const navigate = useNavigate();
	const { canOpenTerminal } = useCapabilities();
	useProjectFocus({ preferredProjectId: projetoId });
	const projectQuery = useQuery(orpc.projects.getById.queryOptions({ input: { id: projetoId } }));
	const actionsQuery = useQuery(
		orpc.projectActions.list.queryOptions({ input: { projectId: projetoId } }),
	);
	const { runs, run, latestFor, clear } = useActionRuns(projetoId);
	const [filter, setFilter] = useState("");
	const [selectedRunId, setSelectedRunId] = useState<string>();
	const project = projectQuery.data;
	const git = actionsQuery.data?.git;
	const needle = filter.trim().toLocaleLowerCase();
	const actions = (actionsQuery.data?.actions ?? []).filter(
		(action) =>
			!needle ||
			action.label.toLocaleLowerCase().includes(needle) ||
			action.command?.toLocaleLowerCase().includes(needle),
	);
	const groups = PROJECT_ACTION_GROUPS.map((group) => ({
		group,
		items: actions.filter((action) => action.group === group),
	})).filter(({ items }) => items.length > 0);

	function showRun(runId: string) {
		setSelectedRunId((current) => (current === runId ? undefined : runId));
	}

	if (!project) {
		return (
			<PageShell title="Painel" icon={Gauge}>
				<Text size="sm" tone="muted">
					{projectQuery.isLoading ? "Carregando projeto..." : "Projeto não encontrado."}
				</Text>
			</PageShell>
		);
	}

	return (
		<PageShell
			title={project.name}
			description="Painel de controle"
			icon={Gauge}
			onBack={() => navigate({ to: "/projetos", search: { projetoId } })}
			contentClassName="overflow-y-auto pb-24 lg:overflow-hidden lg:pb-4"
			actions={
				<div className="flex flex-wrap items-center gap-2">
					<Button variant="outline" size="sm" onClick={() => openFolderInOs(project.mainRoute)}>
						<FolderOpen className="size-3.5" /> Pasta
					</Button>
					{canOpenTerminal && (
						<Button variant="outline" size="sm" onClick={() => openProjectTerminal(project)}>
							<SquareTerminal className="size-3.5" /> Terminal
						</Button>
					)}
					<Button variant="outline" size="icon-sm" asChild>
						<Link to="/projetos/$projetoId" params={{ projetoId }} aria-label="Editar projeto">
							<Pencil className="size-3.5" />
						</Link>
					</Button>
				</div>
			}
		>
			<div className="mx-auto grid w-full max-w-6xl gap-8 px-4 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
				<div className="flex min-w-0 flex-col lg:min-h-0">
					<div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
						<GitStrip git={git} path={project.displayPath} />
						<div className="relative sm:w-56">
							<Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
							<Input
								value={filter}
								onChange={(event) => setFilter(event.target.value)}
								placeholder="Filtrar ações"
								aria-label="Filtrar ações"
								className="h-8 pl-8"
							/>
						</div>
					</div>

					<div className="mt-4 space-y-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-2 lg:[scrollbar-gutter:stable]">
						{actionsQuery.isLoading && (
							<Text size="sm" tone="muted">
								Carregando ações...
							</Text>
						)}
						{!actionsQuery.isLoading && groups.length === 0 && (
							<Text size="sm" tone="muted">
								{needle ? "Nenhuma ação com esse nome." : "Nenhuma ação neste projeto."}
							</Text>
						)}
						{groups.map(({ group, items }) => (
							<section key={group} className="space-y-2">
								<div className="flex items-center gap-2">
									<Title
										as="h2"
										size="sm"
										className="text-muted-foreground uppercase tracking-[0.12em]"
									>
										{PROJECT_ACTION_GROUP_LABELS[group]}
									</Title>
									<span className="font-mono text-[10px] text-muted-foreground">
										{items.length}
									</span>
								</div>
								<div className="grid gap-2 sm:grid-cols-2">
									{items.map((action) => (
										<ActionTile
											key={action.id}
											action={action}
											lastRun={latestFor(action.id)}
											canOpenTerminal={canOpenTerminal}
											onRun={(mode) => run(action, mode)}
											onShowRun={showRun}
										/>
									))}
								</div>
							</section>
						))}
					</div>
				</div>

				<ActionActivity runs={runs} selectedId={selectedRunId} onSelect={showRun} onClear={clear} />
			</div>
		</PageShell>
	);
}

function GitStrip({
	git,
	path,
}: {
	git:
		| { branch: string; changes: number; ahead: number; behind: number; hasUpstream: boolean }
		| null
		| undefined;
	path: string;
}) {
	return (
		<div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
			{git && (
				<>
					<span className="flex items-center gap-1.5 text-foreground">
						<GitBranch className="size-3.5" />
						{git.branch}
					</span>
					<span className="tabular-nums">
						{git.changes === 0
							? "limpo"
							: `${git.changes} ${git.changes === 1 ? "alteração" : "alterações"}`}
					</span>
					{git.hasUpstream && (
						<span className="tabular-nums">
							↑{git.ahead} ↓{git.behind}
						</span>
					)}
				</>
			)}
			<span className="truncate" title={path}>
				{path}
			</span>
		</div>
	);
}
