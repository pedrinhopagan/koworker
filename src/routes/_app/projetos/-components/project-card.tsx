import { Link } from "@tanstack/react-router";

import { Text, Title } from "@/components/typography";
import { useTaskMetrics } from "@/hooks";
import { cn } from "@/lib/utils";
import type { Project } from "../-utils/use-projects-data";
import { ProjectContextMenu } from "./project-context-menu";

type ProjectCardProps = {
	project: Project;
	isSelected: boolean;
};

export function ProjectCard({ project, isSelected }: ProjectCardProps) {
	const { pendingCount, metrics } = useTaskMetrics(project.id);

	const taskLabel =
		metrics.total === 0
			? "Sem tarefas"
			: pendingCount === 0
				? `${metrics.done} concluídas`
				: `${pendingCount} pendente${pendingCount > 1 ? "s" : ""}`;

	const displayPath = project.displayPath;

	// Link absoluto inset-0 seleciona o projeto; o conteúdo é pointer-events-none acima dele (clique no
	// corpo cai no link). Botão direito abre o menu pelo div externo. Igual ao TaskItem.
	return (
		<ProjectContextMenu project={project}>
			<div
				className={cn(
					"relative w-full border border-border px-4 py-3 transition-colors",
					isSelected ? "bg-muted/50" : "bg-card hover:bg-muted/25",
				)}
				style={isSelected ? { boxShadow: `inset 3px 0 0 ${project.color}` } : undefined}
			>
				<Link
					to="/projetos"
					search={{ projetoId: project.id }}
					aria-label={project.name}
					className="absolute inset-0 z-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
				/>

				<div className="pointer-events-none relative z-10 flex items-center gap-3">
					<div className="size-8 shrink-0" style={{ backgroundColor: project.color }} />
					<div className="min-w-0 flex-1">
						<Title size="sm" as="div" className="truncate">
							{project.name}
						</Title>
						<Text size="xs" tone="muted" className="truncate font-mono">
							{displayPath}
						</Text>
					</div>
					<Text size="xs" tone="muted" className="shrink-0 whitespace-nowrap tabular-nums">
						{taskLabel}
					</Text>
				</div>
			</div>
		</ProjectContextMenu>
	);
}
