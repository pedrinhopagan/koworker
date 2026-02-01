import { Link } from "@tanstack/react-router";

import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { ProjectDetail } from "../-utils/use-projects-data";

type ProjectSummaryProps = {
	project: ProjectDetail | undefined | null;
};

type SummaryItemProps = {
	label: string;
	value: string;
};

function SummaryItem({ label, value }: SummaryItemProps) {
	return (
		<div className="rounded-md border border-border bg-muted/30 px-3 py-2">
			<Text size="xs" tone="muted">
				{label}
			</Text>
			<Title size="sm" as="div">
				{value}
			</Title>
		</div>
	);
}

export function ProjectSummary({ project }: ProjectSummaryProps) {
	const total = project?.tasksSummary?.total ?? 0;
	const done = project?.tasksSummary?.done ?? 0;
	const progress = project?.tasksSummary?.progress ?? 0;
	const showValues = Boolean(project?.tasksSummary);

	return (
		<Card>
			<CardHeader className="space-y-1">
				<div className="flex items-center justify-between gap-3">
					<Title size="sm">Resumo do projeto</Title>
					{project && (
						<Button variant="outline" size="sm" asChild>
							<Link to="/projetos/$projetoId" params={{ projetoId: project.id }}>
								Editar
							</Link>
						</Button>
					)}
				</div>
				<Text size="sm" tone="muted">
					{project ? project.name : "Selecione um projeto"}
				</Text>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="grid grid-cols-3 gap-2">
					<SummaryItem label="Total" value={showValues ? String(total) : "--"} />
					<SummaryItem label="Progresso" value={showValues ? `${progress}%` : "--"} />
					<SummaryItem label="Concluídas" value={showValues ? String(done) : "--"} />
				</div>
				<div>
					<Text size="xs" tone="muted" className="mb-2">
						Progresso geral
					</Text>
					<div className="h-2 w-full rounded-full bg-muted">
						<div
							className="h-2 rounded-full bg-primary transition-all"
							style={{ width: showValues ? `${progress}%` : "0%" }}
						/>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
