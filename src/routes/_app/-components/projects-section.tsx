import { Link, useNavigate } from "@tanstack/react-router";
import { FolderOpen } from "lucide-react";
import { memo } from "react";

import { Text, Title } from "@/components/typography";
import { useTaskMetrics } from "@/hooks";
import { cn } from "@/lib/utils";
import type { Project } from "../-utils/use-home-data";
import { SectionHeader } from "./section-header";

// Empty section placeholder
type EmptySectionProps = {
	icon: React.ReactNode;
	message: string;
	linkTo?: string;
	linkLabel?: string;
};

const EmptySection = memo(function EmptySection({
	icon,
	message,
	linkTo,
	linkLabel,
}: EmptySectionProps) {
	return (
		<div className="flex flex-col items-center justify-center py-8 text-center">
			<div className="p-3 bg-muted/30 mb-3">{icon}</div>
			<Text tone="muted" size="sm" className="mb-2">
				{message}
			</Text>
			{linkTo && linkLabel && (
				<Link to={linkTo} className="text-xs text-primary hover:text-primary/80 transition-colors">
					{linkLabel} →
				</Link>
			)}
		</div>
	);
});

// Compact project card
type ProjectCardCompactProps = {
	project: Project;
	onClick?: () => void;
};

const ProjectCardCompact = memo(function ProjectCardCompact({
	project,
	onClick,
}: ProjectCardCompactProps) {
	const navigate = useNavigate();

	function handleClick() {
		if (onClick) {
			return onClick();
		}
		navigate({ to: `/projetos/${project.id}` });
	}

	const { pendingCount } = useTaskMetrics(project.id);

	return (
		<button
			type="button"
			onClick={handleClick}
			className={cn(
				"flex shrink-0 w-48 p-3 border border-border bg-card transition-colors cursor-pointer",
				"hover:border-primary/40 hover:bg-muted/30",
				"focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
			)}
		>
			<div className="flex items-start gap-3">
				<div
					className="size-8 rounded-md flex shrink-0"
					style={{ backgroundColor: `${project.color}30` }}
				/>
				<div className="flex-1 min-w-0 text-left">
					<Title size="sm" as="div" className="truncate">
						{project.name}
					</Title>
					<Text size="xs" tone="muted">
						{pendingCount > 0 ? `${pendingCount} pendente(s)` : "Sem tarefas"}
					</Text>
				</div>
			</div>
		</button>
	);
});

// Projects section component
type ProjectsSectionProps = {
	projects: Project[];
};

export function ProjectsSection({ projects }: ProjectsSectionProps) {
	return (
		<section>
			<SectionHeader
				title="Meus Projetos"
				icon={FolderOpen}
				linkTo="/projetos"
				linkLabel="ver projetos"
				badge={projects.length > 0 ? projects.length : undefined}
				accentColor="hsl(var(--success))"
			/>

			{projects.length === 0 ? (
				<EmptySection
					icon={<FolderOpen size={20} className="text-muted-foreground" />}
					message="Nenhum projeto cadastrado"
					linkTo="/projetos/novo"
					linkLabel="Criar novo projeto"
				/>
			) : (
				<div className="flex overflow-x-auto gap-2 pb-2">
					{projects.map((project) => (
						<ProjectCardCompact key={project.id} project={project} />
					))}
				</div>
			)}
		</section>
	);
}
