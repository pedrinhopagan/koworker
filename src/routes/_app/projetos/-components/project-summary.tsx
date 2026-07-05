import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { FileText, FolderOpen, Plus, TerminalSquare } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { type SortableItemRenderProps, SortableList } from "@/components/ui/sortable-list";
import { Switch } from "@/components/ui/switch";
import { useCapabilities } from "@/hooks/use-capabilities";
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
			<div className="shrink-0 space-y-6 px-4 pt-4 pb-4">
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
							<div className="mt-1.5 flex items-center gap-1.5 text-muted-foreground">
								<FolderOpen className="size-3.5 shrink-0" />
								<span className="truncate font-mono text-xs">{displayPath}</span>
							</div>
						</div>
					</div>
					<Button variant="outline" size="sm" asChild>
						<Link to="/projetos/$projetoId" params={{ projetoId: project.id }}>
							Editar
						</Link>
					</Button>
				</div>

				<div className="grid grid-cols-3 gap-px border border-border bg-border">
					<MetricCell label="Total" value={total} />
					<MetricCell label="Pendentes" value={pending} />
					<MetricCell label="Concluídas" value={done} accentColor={project.color} />
				</div>

				<div>
					<div className="mb-2 flex items-center justify-between">
						<Text size="xs" tone="muted" className="uppercase tracking-[0.18em]">
							Progresso
						</Text>
						<Text size="xs" tone="muted" className="tabular-nums">
							{progress}%
						</Text>
					</div>
					<div className="h-2 w-full bg-muted">
						<div
							className="h-2 transition-all"
							style={{ width: `${progress}%`, backgroundColor: project.color }}
						/>
					</div>
				</div>

				<label className="flex cursor-pointer items-center justify-between gap-4 border border-border bg-card px-4 py-3">
					<div className="flex items-center gap-2.5">
						<TerminalSquare className="size-4 shrink-0 text-muted-foreground" />
						<div>
							<Text size="sm" as="div">
								Mostrar terminal
							</Text>
							<Text size="xs" tone="muted">
								Atalho de terminal na página do projeto.
							</Text>
						</div>
					</div>
					<Switch
						checked={!project.hideTerminal}
						disabled={updateMutation.isPending}
						onCheckedChange={(checked) =>
							updateMutation.mutate({ id: project.id, hideTerminal: !checked })
						}
					/>
				</label>
			</div>

			<div className="px-4 pb-6 space-y-6 md:flex-1 md:min-h-0 md:overflow-y-auto md:[scrollbar-gutter:stable]">
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

	// Agrupa por pasta e ordena os grupos por profundidade: a raiz primeiro, depois as pastas
	// progressivamente mais internas. Dentro de cada grupo, ordem por nome.
	const groups = useMemo(() => {
		const byDir = new Map<string, typeof docs>();
		for (const doc of docs) {
			const list = byDir.get(doc.dirLabel) ?? [];
			list.push(doc);
			byDir.set(doc.dirLabel, list);
		}

		const depth = (dirLabel: string) => dirLabel.split("/").filter(Boolean).length;

		return [...byDir.entries()]
			.sort(([a], [b]) => depth(a) - depth(b) || a.localeCompare(b))
			.map(([dirLabel, files]) => ({
				dirLabel,
				files: files.sort((a, b) => a.name.localeCompare(b.name)),
			}));
	}, [docs]);

	if (docs.length === 0) {
		return null;
	}

	return (
		<div className="space-y-3">
			<Text size="xs" tone="muted" className="uppercase tracking-[0.18em]">
				Documentos ({docs.length})
			</Text>

			<div className="space-y-4">
				{groups.map((group) => (
					<div key={group.dirLabel} className="space-y-0.5">
						{group.files.map((doc) => (
							<Link
								key={doc.path}
								to="/projetos/$projetoId/docs/$"
								params={{ projetoId: projectId, _splat: doc.path }}
								className="flex items-center gap-2.5 border border-border bg-card px-3 py-2 transition-colors hover:bg-accent"
							>
								<FileText className="size-4 shrink-0 text-muted-foreground" />
								<span className="min-w-0 flex-1 truncate font-mono text-sm font-medium">
									{doc.name}
								</span>
								<span className="ml-3 max-w-[45%] truncate font-mono text-xs text-muted-foreground/50">
									{group.dirLabel}
								</span>
							</Link>
						))}
					</div>
				))}
			</div>
		</div>
	);
}

type MetricCellProps = {
	label: string;
	value: number;
	accentColor?: string;
};

function MetricCell({ label, value, accentColor }: MetricCellProps) {
	return (
		<div className="bg-card px-4 py-3">
			<Text size="xs" tone="muted" className="uppercase tracking-[0.12em]">
				{label}
			</Text>
			<Title
				as="div"
				className="mt-1 text-2xl font-extrabold leading-none tabular-nums"
				style={accentColor ? { color: accentColor } : undefined}
			>
				{value}
			</Title>
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

	const shortcutCount = ordered.length + (showTerminal ? 1 : 0);

	return (
		<div className="space-y-2">
			<Text size="xs" tone="muted" className="uppercase tracking-[0.18em]">
				Atalhos ({shortcutCount})
			</Text>

			{showTerminal ? (
				<ProjectRouteShortcutItem
					project={{
						id: project.id,
						name: project.name,
						mainRoute: project.mainRoute,
					}}
					isTerminal
				/>
			) : null}

			{ordered.length === 0 ? (
				showTerminal ? null : (
					<Text size="sm" tone="muted" className="py-3">
						Nenhum atalho cadastrado.
					</Text>
				)
			) : (
				<SortableList
					items={ordered}
					onReorder={(items) => {
						setOrdered(items);
						onReorder(items.map((i) => i.id));
					}}
					renderItem={renderItem}
				/>
			)}

			<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
				<Text size="xs" tone="muted">
					Clique para executar; clique direito para mais opções. Arraste para reordenar.
				</Text>
				<Link
					to="/projetos/$projetoId"
					params={{ projetoId: project.id }}
					className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
				>
					<Plus className="size-3" />
					Adicionar atalho
				</Link>
			</div>
		</div>
	);
}
