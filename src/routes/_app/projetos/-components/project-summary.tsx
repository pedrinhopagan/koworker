import { Text, Title } from "@/components/typography";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Project } from "../-utils/use-projects-data";

type ProjectSummaryProps = {
	project: Project | undefined;
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
	return (
		<Card>
			<CardHeader className="space-y-1">
				<Title size="sm">Resumo do projeto</Title>
				<Text size="sm" tone="muted">
					{project ? project.name : "Selecione um projeto"}
				</Text>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="grid grid-cols-2 gap-2">
					<SummaryItem label="Total" value="--" />
					<SummaryItem label="Progresso" value="--" />
					<SummaryItem label="Pendentes" value="--" />
					<SummaryItem label="Concluídas" value="--" />
				</div>
				<div>
					<Text size="xs" tone="muted" className="mb-2">
						Progresso geral
					</Text>
					<div className="h-2 w-full rounded-full bg-muted">
						<div className="h-2 w-0 rounded-full bg-primary" />
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
