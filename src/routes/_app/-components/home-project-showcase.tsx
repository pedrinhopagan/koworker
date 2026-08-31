import { Link } from "@tanstack/react-router";
import { FolderKanban, ListTodo, Settings2, SquareTerminal, type LucideIcon } from "lucide-react";

import type { RouterOutputs } from "@/client";
import { Text, Title } from "@/components/typography";

type HomeProject = NonNullable<RouterOutputs["projects"]["getById"]>;

type HomeProjectShowcaseProps = {
	project: HomeProject;
};

const numberFmt = new Intl.NumberFormat("pt-BR");

export function HomeProjectShowcase({ project }: HomeProjectShowcaseProps) {
	const { total, pending, done, progress } = project.tasksSummary;
	const accentColor = project.color ?? "var(--primary)";

	return (
		<aside
			aria-labelledby="project-context-title"
			className="border border-border bg-card shadow-xs"
		>
			<header className="border-b border-border px-4 py-4 sm:px-5">
				<div className="flex items-center gap-2">
					<span className="size-2 shrink-0" style={{ backgroundColor: accentColor }} />
					<Text size="xs" tone="muted" className="uppercase tracking-[0.16em]">
						Projeto em foco
					</Text>
				</div>
				<Title
					id="project-context-title"
					as="h2"
					className="mt-2 truncate text-xl tracking-[-0.025em]"
				>
					{project.name}
				</Title>
				<Text size="xs" tone="muted" className="mt-1 truncate font-mono">
					{project.displayPath}
				</Text>
			</header>

			<div className="px-4 py-4 sm:px-5">
				<div className="flex items-end justify-between gap-4">
					<div>
						<Text size="xs" tone="muted">
							Progresso geral
						</Text>
						<Title as="div" className="mt-1 text-3xl tabular-nums">
							{progress}%
						</Title>
					</div>
					<Text size="xs" tone="muted" className="pb-1 tabular-nums">
						{numberFmt.format(done)} de {numberFmt.format(total)}
					</Text>
				</div>
				<div
					className="mt-3 h-1.5 overflow-hidden bg-muted"
					role="progressbar"
					aria-label="Progresso geral"
					aria-valuenow={progress}
					aria-valuemin={0}
					aria-valuemax={100}
				>
					<div
						className="h-full transition-[width]"
						style={{ width: `${progress}%`, backgroundColor: accentColor }}
					/>
				</div>
				<div className="mt-4 grid grid-cols-2 gap-px border border-border bg-border">
					<Metric label="Pendentes" value={pending} />
					<Metric label="Concluídas" value={done} />
				</div>
			</div>

			<div className="border-t border-border px-4 py-4 sm:px-5">
				<Text size="xs" tone="muted" className="mb-2 uppercase tracking-[0.14em]">
					Ações rápidas
				</Text>
				<div className="grid grid-cols-2 gap-2">
					<QuickAction to="/tarefas" label="Tarefas" icon={ListTodo} />
					<QuickAction to="/shells" label="Sala" icon={SquareTerminal} />
					<QuickAction
						to="/projetos/$projetoId"
						params={{ projetoId: project.id }}
						label="Configurar"
						icon={Settings2}
					/>
					<QuickAction to="/projetos" label="Projetos" icon={FolderKanban} />
				</div>
			</div>
		</aside>
	);
}

function Metric({ label, value }: { label: string; value: number }) {
	return (
		<div className="bg-card px-3 py-3">
			<Title as="div" className="text-xl tabular-nums">
				{numberFmt.format(value)}
			</Title>
			<Text size="xs" tone="muted">
				{label}
			</Text>
		</div>
	);
}

type QuickActionProps = {
	to: "/tarefas" | "/shells" | "/projetos" | "/projetos/$projetoId";
	params?: { projetoId: string };
	label: string;
	icon: LucideIcon;
};

function QuickAction({ to, params, label, icon: Icon }: QuickActionProps) {
	return (
		<Link
			to={to}
			params={params}
			className="flex min-h-16 flex-col justify-between border border-border bg-background p-3 text-xs font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
		>
			<Icon className="size-4 text-muted-foreground" aria-hidden />
			<span>{label}</span>
		</Link>
	);
}
