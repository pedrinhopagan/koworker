import { Link } from "@tanstack/react-router";

import { ProjectLogo } from "@/components/project-logo";
import { Text, Title } from "@/components/typography";
import { cn } from "@/lib/utils";
import type { Project } from "../-utils/use-projects-data";
import { ProjectContextMenu } from "./project-context-menu";

type ProjectCardProps = {
	project: Project;
	isSelected: boolean;
};

export function ProjectCard({ project, isSelected }: ProjectCardProps) {
	const metrics = project.tasksSummary;
	const taskCount = metrics.total === 0 || metrics.pending > 0 ? metrics.pending : metrics.done;

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
					className="absolute inset-0 z-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
				/>
				<div className="pointer-events-none relative z-10 flex items-center gap-3">
					<ProjectLogo project={project} />
					<div className="min-w-0 flex-1">
						<Title size="sm" as="div" className="truncate">
							{project.name}
						</Title>
						<Text size="xs" tone="muted" className="truncate font-mono">
							{project.displayPath}
						</Text>
					</div>
					<Text size="xs" tone="muted" className="shrink-0 tabular-nums">
						{taskCount}
					</Text>
				</div>
			</div>
		</ProjectContextMenu>
	);
}
