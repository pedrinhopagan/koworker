import { Link } from "@tanstack/react-router";

import { Text, Title } from "@/components/typography";
import { useTaskMetrics } from "@/hooks";
import { cn } from "@/lib/utils";
import type { Project } from "../-utils/use-projects-data";

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

	const displayPath = project.mainRoute.replace(/^\/home\/[^/]+/, "");

	return (
		<Link
			to="/projetos"
			search={{ projetoId: project.id }}
			className={cn(
				"block w-full border border-border px-4 py-3 transition-colors",
				isSelected ? "bg-muted/50" : "bg-card hover:bg-muted/25",
			)}
			style={isSelected ? { boxShadow: `inset 3px 0 0 ${project.color}` } : undefined}
		>
			<div className="flex items-center gap-3">
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
		</Link>
	);
}
