import { Link } from "@tanstack/react-router";
import { FolderKanban, ListTodo, Settings2, SquareTerminal, type LucideIcon } from "lucide-react";

import type { RouterOutputs } from "@/client";
import { Text, Title } from "@/components/typography";
import { cn } from "@/lib/utils";

type HomeProject = NonNullable<RouterOutputs["projects"]["getById"]>;

type HomeProjectShowcaseProps = {
	project: HomeProject;
};

const numberFmt = new Intl.NumberFormat("pt-BR");
const PROGRESS_CELLS = 24;

export function HomeProjectShowcase({ project }: HomeProjectShowcaseProps) {
	const { total, pending, done, progress } = project.tasksSummary;
	const accentColor = project.color ?? "var(--primary)";

	return (
		<aside
			aria-labelledby="project-context-title"
			className="animate-stagger-fade-in border border-border bg-card shadow-xs [animation-delay:120ms]"
		>
			<header className="border-b border-border px-4 py-4 sm:px-5">
				<div className="flex items-center gap-2">
					<span className="size-2 shrink-0" style={{ backgroundColor: accentColor }} />
					<Text
						id="project-context-title"
						as="span"
						size="xs"
						tone="muted"
						className="uppercase tracking-[0.16em]"
					>
						Progresso do projeto
					</Text>
				</div>
				<div className="mt-2 flex items-end justify-between gap-4">
					<Title
						as="div"
						className="text-5xl leading-none tracking-[-0.05em] tabular-nums"
						style={{ color: accentColor }}
					>
						{progress}
						<span className="text-2xl text-muted-foreground">%</span>
					</Title>
					<Text size="xs" tone="muted" className="pb-0.5 font-mono tabular-nums">
						{numberFmt.format(done)}/{numberFmt.format(total)}
					</Text>
				</div>
				<div
					className="mt-4 grid gap-0.5"
					style={{ gridTemplateColumns: `repeat(${PROGRESS_CELLS}, minmax(0, 1fr))` }}
					role="progressbar"
					aria-label="Progresso geral"
					aria-valuenow={progress}
					aria-valuemin={0}
					aria-valuemax={100}
				>
					{Array.from({ length: PROGRESS_CELLS }, (_cell, index) => {
						const filled = index < Math.round((progress / 100) * PROGRESS_CELLS);
						return (
							<span
								key={index}
								aria-hidden
								className={cn("animate-stagger-fade-in h-2.5", !filled && "bg-muted")}
								style={{
									animationDelay: `${200 + index * 20}ms`,
									backgroundColor: filled ? accentColor : undefined,
								}}
							/>
						);
					})}
				</div>
			</header>

			<div className="px-4 py-4 sm:px-5">
				<div className="grid grid-cols-2 gap-px border border-border bg-border">
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
			<Title as="div" className="text-2xl leading-none tracking-[-0.03em] tabular-nums">
				{numberFmt.format(value)}
			</Title>
			<Text size="xs" tone="muted" className="mt-1">
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
			className="group flex min-h-16 flex-col justify-between border border-border bg-background p-3 text-xs font-semibold transition-[background-color,transform] hover:-translate-y-px hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
		>
			<Icon
				className="size-4 text-muted-foreground transition-colors group-hover:text-foreground"
				aria-hidden
			/>
			<span>{label}</span>
		</Link>
	);
}
