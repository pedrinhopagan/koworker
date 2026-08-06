import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	Bot,
	Command,
	FolderOpen,
	type LucideIcon as LucideIconComponent,
	Pencil,
	Plus,
	TerminalSquare,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { type SortableItemRenderProps, SortableList } from "@/components/ui/sortable-list";
import { Switch } from "@/components/ui/switch";
import { isProjectCliRoute, PROJECT_DOC_NAMES, resolveProjectDocIcon } from "@/constants/projects";
import { useCapabilities } from "@/hooks/use-capabilities";
import { LucideIcon } from "@/lib/lucide-icon";
import type { ProjectDetail } from "../-utils/use-projects-data";
import { ProjectRouteShortcutItem } from "./project-route-shortcut-item";

type Project = NonNullable<ProjectDetail>;
type ProjectRoute = Project["routes"][number];

type ProjectSummaryProps = {
	project: ProjectDetail | undefined | null;
};

export function ProjectSummary({ project }: ProjectSummaryProps) {
	const queryClient = useQueryClient();

	const invalidateProjects = (projectId: string) => {
		queryClient.invalidateQueries({
			queryKey: orpc.projects.list.queryOptions().queryKey,
		});
		queryClient.invalidateQueries({
			queryKey: orpc.projects.overview.queryOptions().queryKey,
		});
		queryClient.invalidateQueries({
			queryKey: orpc.projects.getById.queryOptions({ input: { id: projectId } }).queryKey,
		});
	};

	const updateMutation = useMutation({
		...orpc.projects.update.mutationOptions(),
		onSuccess: (_data, variables) => invalidateProjects(variables.id),
		onError: (error) => toast.error(`Erro ao atualizar projeto: ${error.message}`),
	});

	const reorderRoutesMutation = useMutation({
		...orpc.projectRoutes.reorder.mutationOptions(),
		onSuccess: () => {
			if (project) invalidateProjects(project.id);
		},
		onError: (error) => toast.error(`Erro ao reordenar atalhos: ${error.message}`),
	});

	if (!project) {
		return (
			<div className="border border-border bg-card px-6 py-14 text-center">
				<Title size="sm" as="div">
					Selecione um projeto
				</Title>
				<Text size="sm" tone="muted" className="mt-1">
					Escolha um projeto na lista para ver os detalhes.
				</Text>
			</div>
		);
	}

	const summary = project.tasksSummary;
	const total = summary?.total ?? 0;
	const pending = summary?.pending ?? 0;
	const done = summary?.done ?? 0;
	const progress = summary?.progress ?? 0;
	const displayPath = project.displayPath;

	return (
		<div className="flex flex-col md:h-full md:min-h-0">
			<div className="shrink-0 border-b border-border bg-card/30 px-5 py-4">
				<div className="flex items-start justify-between gap-4">
					<div className="flex min-w-0 items-start gap-3">
						<div className="mt-0.5 size-9 shrink-0" style={{ backgroundColor: project.color }} />
						<div className="min-w-0">
							<Title size="lg" className="truncate">
								{project.name}
							</Title>
							{project.description && (
								<Text size="sm" tone="muted" className="mt-0.5 line-clamp-2">
									{project.description}
								</Text>
							)}
							<div className="mt-2 flex items-center gap-1.5 text-muted-foreground">
								<FolderOpen className="size-3.5 shrink-0" />
								<span className="truncate font-mono text-xs">{displayPath}</span>
							</div>
						</div>
					</div>
					<Button variant="outline" size="sm" asChild>
						<Link
							to="/projetos/$projetoId"
							params={{ projetoId: project.id }}
							className="cursor-pointer"
						>
							<Pencil className="size-3.5" />
							Editar
						</Link>
					</Button>
				</div>

				<div className="mt-4 grid grid-cols-[repeat(3,minmax(0,1fr))_auto] items-stretch gap-px border border-border bg-border">
					<MetricCell label="Tarefas" value={total} />
					<MetricCell label="Pendentes" value={pending} />
					<MetricCell label="Concluídas" value={done} accentColor={project.color} />
					<label className="flex min-w-28 cursor-pointer items-center justify-center gap-2 bg-card px-3 py-2.5">
						<TerminalSquare className="size-4 text-muted-foreground" />
						<Text as="span" size="xs" tone="muted" className="hidden lg:inline">
							Terminal
						</Text>
						<Switch
							checked={!project.hideTerminal}
							disabled={updateMutation.isPending}
							onCheckedChange={(checked) =>
								updateMutation.mutate({
									id: project.id,
									hideTerminal: !checked,
								})
							}
						/>
					</label>
				</div>
				<div className="mt-2 h-1 w-full bg-muted">
					<div
						className="h-1 transition-all"
						style={{ width: `${progress}%`, backgroundColor: project.color }}
					/>
				</div>
			</div>

			<div className="space-y-8 px-5 py-5 md:min-h-0 md:flex-1 md:overflow-y-auto md:[scrollbar-gutter:stable]">
				<SummaryRoutes
					key={project.id}
					project={{
						id: project.id,
						name: project.name,
						mainRoute: project.mainRoute,
						hideTerminal: project.hideTerminal,
					}}
					routes={project.routes}
					onReorder={(orderedIds) => reorderRoutesMutation.mutate({ orderedIds })}
				/>

				<SummaryDocs projectId={project.id} />
			</div>
		</div>
	);
}

type SummaryDocsProps = {
	projectId: string;
};

// Docs principais (CLAUDE.md, AGENTS.md, …) detectados na raiz do projeto. Listados como os
// arquivos soltos do vault, cada um abre a tela de edição própria. Some quando o projeto não tem
// nenhum desses arquivos.
function SummaryDocs({ projectId }: SummaryDocsProps) {
	const docsQuery = useQuery(orpc.projects.listDocs.queryOptions({ input: { id: projectId } }));
	const docs = useMemo(() => docsQuery.data ?? [], [docsQuery.data]);
	const groups = useMemo(
		() =>
			PROJECT_DOC_NAMES.map((name) => ({
				name,
				docs: docs
					.filter((doc) => doc.name === name)
					.sort(
						(a, b) =>
							a.dirLabel.split("/").filter(Boolean).length -
								b.dirLabel.split("/").filter(Boolean).length ||
							a.dirLabel.localeCompare(b.dirLabel),
					),
			})).filter((group) => group.docs.length > 0),
		[docs],
	);

	if (docs.length === 0) {
		return null;
	}

	return (
		<section className="space-y-4">
			<div className="flex items-center gap-2 border-b border-border pb-2">
				<FolderOpen className="size-4 text-muted-foreground" />
				<Title as="h2" size="sm">
					Documentos
				</Title>
				<span className="flex size-5 items-center justify-center bg-muted font-mono text-[10px] text-muted-foreground">
					{docs.length}
				</span>
			</div>

			{groups.map((group) => (
				<div key={group.name} className="space-y-2">
					<div className="flex items-center gap-2">
						<LucideIcon
							name={resolveProjectDocIcon(group.name)}
							className="size-3.5 text-muted-foreground"
						/>
						<Text
							as="div"
							size="xs"
							tone="muted"
							className="font-mono font-semibold uppercase tracking-[0.12em]"
						>
							{group.name}
						</Text>
						<span className="flex size-5 items-center justify-center bg-muted font-mono text-[10px] text-muted-foreground">
							{group.docs.length}
						</span>
					</div>

					<div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
						{group.docs.map((doc) => (
							<Link
								key={doc.path}
								to="/projetos/$projetoId/docs/$"
								params={{ projetoId: projectId, _splat: doc.path }}
								className="group flex min-h-12 min-w-0 cursor-pointer items-center gap-2.5 border border-border bg-card px-2.5 py-2 transition-colors hover:border-foreground/25 hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
							>
								<div className="flex size-8 shrink-0 items-center justify-center border border-border bg-muted/40 transition-colors group-hover:bg-background">
									<LucideIcon
										name={resolveProjectDocIcon(doc.name)}
										className="size-4 text-foreground"
									/>
								</div>
								<div className="min-w-0 flex-1">
									<Text as="div" size="xs" className="truncate font-mono font-semibold">
										{doc.dirLabel}
									</Text>
									<Text as="div" size="xs" tone="muted" className="truncate font-mono text-[10px]">
										{doc.path}
									</Text>
								</div>
							</Link>
						))}
					</div>
				</div>
			))}
		</section>
	);
}

type MetricCellProps = {
	label: string;
	value: number;
	accentColor?: string;
};

function MetricCell({ label, value, accentColor }: MetricCellProps) {
	return (
		<div className="flex items-baseline gap-2 bg-card px-3 py-2.5">
			<Title
				as="div"
				className="text-lg font-extrabold leading-none tabular-nums"
				style={accentColor ? { color: accentColor } : undefined}
			>
				{value}
			</Title>
			<Text size="xs" tone="muted" className="truncate">
				{label}
			</Text>
		</div>
	);
}

type SummaryRoutesProps = {
	project: {
		id: string;
		name: string;
		mainRoute: string;
		hideTerminal: boolean;
	};
	routes: ProjectRoute[];
	onReorder: (orderedIds: string[]) => void;
};

function SummaryRoutes({ project, routes, onReorder }: SummaryRoutesProps) {
	const { canOpenTerminal } = useCapabilities();
	const showTerminal = canOpenTerminal && !project.hideTerminal;

	const sorted = useMemo(
		() => [...routes].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
		[routes],
	);
	const [ordered, setOrdered] = useState<ProjectRoute[]>(sorted);

	useEffect(() => {
		setOrdered((prev) => {
			if (prev.length === sorted.length && prev.every((r, i) => r.id === sorted[i]?.id)) {
				return prev;
			}
			return sorted;
		});
	}, [sorted]);

	function renderItem(route: ProjectRoute, props: SortableItemRenderProps) {
		return (
			<ProjectRouteShortcutItem
				project={{
					id: project.id,
					name: project.name,
					mainRoute: project.mainRoute,
				}}
				route={route}
				sortable={props}
			/>
		);
	}

	const cliRoutes = ordered.filter(isProjectCliRoute);
	const commandRoutes = ordered.filter((route) => !isProjectCliRoute(route));
	const shortcutCount = ordered.length + (showTerminal ? 1 : 0);

	function handleGroupReorder(group: "cli" | "command", items: ProjectRoute[]) {
		const next = group === "cli" ? [...items, ...commandRoutes] : [...cliRoutes, ...items];
		setOrdered(next);
		onReorder(next.map((item) => item.id));
	}

	return (
		<section className="space-y-5">
			<div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
				<div>
					<Title as="h2" size="lg">
						Atalhos do projeto
					</Title>
					<Text size="xs" tone="muted" className="mt-0.5">
						{shortcutCount} {shortcutCount === 1 ? "ação disponível" : "ações disponíveis"}
					</Text>
				</div>
				<Button variant="outline" size="sm" asChild>
					<Link
						to="/projetos/$projetoId"
						params={{ projetoId: project.id }}
						className="cursor-pointer"
					>
						<Plus className="size-3.5" />
						Adicionar
					</Link>
				</Button>
			</div>

			{showTerminal && (
				<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
					<ProjectRouteShortcutItem
						project={{
							id: project.id,
							name: project.name,
							mainRoute: project.mainRoute,
						}}
						isTerminal
					/>
				</div>
			)}

			{cliRoutes.length > 0 && (
				<ShortcutGroup title="CLIs" count={cliRoutes.length} icon={Bot}>
					<SortableList
						items={cliRoutes}
						onReorder={(items) => handleGroupReorder("cli", items)}
						renderItem={renderItem}
						strategy="grid"
						className="gap-2"
					/>
				</ShortcutGroup>
			)}

			{commandRoutes.length > 0 && (
				<ShortcutGroup title="Outros comandos" count={commandRoutes.length} icon={Command}>
					<SortableList
						items={commandRoutes}
						onReorder={(items) => handleGroupReorder("command", items)}
						renderItem={renderItem}
						strategy="grid"
						className="gap-2"
					/>
				</ShortcutGroup>
			)}

			{shortcutCount === 0 && (
				<div className="border border-dashed border-border bg-card px-6 py-10 text-center">
					<Command className="mx-auto size-7 text-muted-foreground" />
					<Title as="div" size="sm" className="mt-3">
						Nenhum atalho cadastrado
					</Title>
					<Text size="xs" tone="muted" className="mt-1">
						Adicione uma CLI ou comando para acessar este projeto rapidamente.
					</Text>
				</div>
			)}

			<Text size="xs" tone="muted">
				Clique para abrir · clique direito para mais opções · arraste pelo puxador para reordenar
			</Text>
		</section>
	);
}

type ShortcutGroupProps = {
	title: string;
	count: number;
	icon: LucideIconComponent;
	children: ReactNode;
};

function ShortcutGroup({ title, count, icon: Icon, children }: ShortcutGroupProps) {
	return (
		<div className="space-y-2.5">
			<div className="flex items-center gap-2">
				<Icon className="size-4 text-muted-foreground" />
				<Text as="div" size="xs" tone="muted" className="font-semibold uppercase tracking-[0.16em]">
					{title}
				</Text>
				<span className="flex size-5 items-center justify-center bg-muted font-mono text-[10px] text-muted-foreground">
					{count}
				</span>
			</div>
			{children}
		</div>
	);
}
