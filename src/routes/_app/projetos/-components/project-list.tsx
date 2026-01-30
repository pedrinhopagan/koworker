import { Link } from "@tanstack/react-router";

import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import type { Project } from "../-utils/use-projects-data";
import { ProjectCard } from "./project-card";

type ProjectListProps = {
	projects: Project[];
	selectedId: string | undefined;
	loading: boolean;
};

export function ProjectList({ projects, selectedId, loading }: ProjectListProps) {
	if (loading) {
		return (
			<Text size="sm" tone="muted">
				Carregando projetos...
			</Text>
		);
	}

	return (
		<section className="space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<Title size="sm">Meus projetos</Title>
					<Text size="sm" tone="muted">
						{projects.length} projetos cadastrados
					</Text>
				</div>
				<Button variant="secondary" asChild>
					<Link to="/projetos/novo">Novo projeto</Link>
				</Button>
			</div>

			<div className="grid gap-3">
				{projects.map((project) => (
					<ProjectCard key={project.id} project={project} isSelected={project.id === selectedId} />
				))}
			</div>
		</section>
	);
}
