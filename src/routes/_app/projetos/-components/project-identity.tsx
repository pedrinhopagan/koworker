import { Link } from "@tanstack/react-router";
import { FolderOpen, Pencil, TerminalSquare } from "lucide-react";

import { ProjectLogo } from "@/components/project-logo";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { ProjectDetail } from "../-utils/use-projects-data";

type Project = NonNullable<ProjectDetail>;

type ProjectIdentityProps = {
	project: Project;
	terminalUpdating: boolean;
	onTerminalChange: (visible: boolean) => void;
};

export function ProjectIdentity({
	project,
	terminalUpdating,
	onTerminalChange,
}: ProjectIdentityProps) {
	const summary = project.tasksSummary;
	const total = summary?.total ?? 0;
	const pending = summary?.pending ?? 0;
	const done = summary?.done ?? 0;
	const progress = summary?.progress ?? 0;

	return (
		<section className="flex min-w-0 flex-col">
			<div className="flex items-start justify-between gap-3 border-b border-border pb-4">
				<div className="flex min-w-0 items-start gap-3">
					<ProjectLogo project={project} className="size-10" />
					<div className="min-w-0">
						<Text size="xs" tone="faint" className="font-mono uppercase tracking-[0.14em]">
							Resumo
						</Text>
						<Title size="lg" className="mt-1 truncate">
							{project.name}
						</Title>
					</div>
				</div>
				<Button variant="outline" size="icon-sm" asChild>
					<Link
						to="/projetos/$projetoId"
						params={{ projetoId: project.id }}
						aria-label="Editar projeto"
					>
						<Pencil className="size-3.5" />
					</Link>
				</Button>
			</div>

			{project.description && (
				<Text size="sm" tone="muted" className="mt-4 line-clamp-4 leading-relaxed">
					{project.description}
				</Text>
			)}

			<div className="mt-4 flex min-w-0 items-center gap-2 border-y border-border py-3 text-muted-foreground">
				<FolderOpen className="size-3.5 shrink-0" />
				<Text as="span" size="xs" className="truncate font-mono">
					{project.displayPath}
				</Text>
			</div>

			<div className="mt-5 grid grid-cols-3 divide-x divide-border border-y border-border">
				<Metric label="Tarefas" value={total} />
				<Metric label="Abertas" value={pending} />
				<Metric label="Feitas" value={done} color={project.color} />
			</div>
			<div className="mt-2 h-1 bg-muted">
				<div
					className="h-full transition-all"
					style={{ width: `${progress}%`, backgroundColor: project.color }}
				/>
			</div>
			<Text size="xs" tone="faint" className="mt-1 text-right font-mono tabular-nums">
				{progress}% concluído
			</Text>

			<label className="mt-5 flex cursor-pointer items-center justify-between gap-3 border border-border bg-muted/20 px-3 py-3">
				<span className="flex items-center gap-2">
					<TerminalSquare className="size-4 text-muted-foreground" />
					<Text as="span" size="xs" className="font-semibold">
						Terminal no launchpad
					</Text>
				</span>
				<Switch
					checked={!project.hideTerminal}
					disabled={terminalUpdating}
					onCheckedChange={onTerminalChange}
				/>
			</label>
		</section>
	);
}

function Metric({ label, value, color }: { label: string; value: number; color?: string }) {
	return (
		<div className="px-2 py-3 text-center">
			<Title
				as="div"
				size="lg"
				className="font-mono tabular-nums"
				style={color ? { color } : undefined}
			>
				{value}
			</Title>
			<Text size="xs" tone="faint" className="mt-0.5">
				{label}
			</Text>
		</div>
	);
}
