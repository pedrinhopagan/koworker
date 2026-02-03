import { Link } from "@tanstack/react-router";
import { tv } from "tailwind-variants";

import { Text, Title } from "@/components/typography";
import { useTaskMetrics } from "@/hooks";
import { cn } from "@/lib/utils";
import type { Project } from "../-utils/use-projects-data";

type ProjectCardProps = {
	project: Project;
	isSelected: boolean;
};

const cardVariants = tv({
	base: "rounded-md border border-border bg-card px-4 py-3 transition",
	variants: {
		active: {
			true: "border-primary/60 bg-muted/60",
			false: "hover:border-muted-foreground/40",
		},
	},
});

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
			className={cn(cardVariants({ active: isSelected }), "block w-full")}
		>
			<div className="flex items-start gap-3">
				<div
					className="mt-1 size-9 rounded-md shrink-0"
					style={{ backgroundColor: project.color }}
				/>
				<div className="flex-1">
					<Title size="sm" as="div">
						{project.name}
					</Title>
					<Text size="sm" tone="muted" className="truncate line-clamp-1">
						{displayPath}
					</Text>
					<div className="mt-2 flex flex-wrap items-center gap-3">
						<Text size="xs" tone="muted">
							{taskLabel}
						</Text>
					</div>
				</div>
				<div
					className="mt-1 size-2 rounded-full shrink-0"
					style={{ backgroundColor: project.color }}
				/>
			</div>
		</Link>
	);
}
