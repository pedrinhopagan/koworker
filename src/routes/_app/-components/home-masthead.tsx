import type { RouterOutputs } from "@/client";
import { Text, Title } from "@/components/typography";
import { AGENT_RADAR_STATUS_LABELS } from "@/constants/agent-radar";
import { useAgentRadar } from "@/hooks/use-agent-radar";
import { cn } from "@/lib/utils";

type HomeProject = NonNullable<RouterOutputs["projects"]["getById"]>;

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
	weekday: "short",
	day: "2-digit",
	month: "short",
	year: "numeric",
});

const numberFmt = new Intl.NumberFormat("pt-BR");

export function HomeMasthead({ project }: { project: HomeProject }) {
	const { agents } = useAgentRadar();
	const blocked = agents.filter((agent) => agent.status === "blocked").length;
	const working = agents.filter((agent) => agent.status === "working").length;
	const { total, pending, done, progress } = project.tasksSummary;

	return (
		<section
			aria-label="Resumo do projeto"
			className="animate-stagger-fade-in border border-border bg-card shadow-xs"
		>
			<div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-12 lg:items-end">
				<div className="min-w-0 lg:col-span-7">
					<Text
						size="xs"
						tone="muted"
						className="font-mono uppercase tracking-[0.18em] tabular-nums"
					>
						{dateFmt.format(new Date())}
					</Text>
					<Title
						as="h1"
						className="mt-3 truncate text-4xl leading-[0.95] tracking-[-0.045em] sm:text-6xl"
					>
						{project.name}
					</Title>
					<Text size="xs" tone="muted" className="mt-3 truncate font-mono">
						{project.displayPath}
					</Text>
				</div>

				<dl className="grid grid-cols-3 border-t border-border lg:col-span-5 lg:border-t-0 lg:border-l">
					<Ledger
						label={AGENT_RADAR_STATUS_LABELS.blocked}
						value={blocked}
						activeClassName="text-warning"
					/>
					<Ledger
						label={AGENT_RADAR_STATUS_LABELS.working}
						value={working}
						activeClassName="text-primary"
					/>
					<Ledger label="Agents" value={agents.length} />
				</dl>
			</div>

			<div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-6 py-4 sm:px-9">
				<Text
					as="span"
					size="sm"
					className="w-10 shrink-0 font-semibold tabular-nums text-[color:var(--project-accent,var(--primary))]"
				>
					{progress}%
				</Text>
				<div
					role="progressbar"
					aria-label="Tarefas concluídas"
					aria-valuenow={progress}
					aria-valuemin={0}
					aria-valuemax={100}
					className="h-1.5 min-w-40 flex-1 bg-muted"
				>
					<div
						className="h-full bg-[var(--project-accent,var(--primary))]"
						style={{ width: `${progress}%` }}
					/>
				</div>
				<Text as="span" size="xs" tone="muted" className="shrink-0 font-mono tabular-nums">
					{numberFmt.format(done)} de {numberFmt.format(total)} tarefas ·{" "}
					{numberFmt.format(pending)} pendentes
				</Text>
			</div>
		</section>
	);
}

function Ledger({
	label,
	value,
	activeClassName,
}: {
	label: string;
	value: number;
	activeClassName?: string;
}) {
	return (
		<div className="min-w-0 px-4 pt-4 first:pl-0 lg:pt-0 lg:first:pl-8">
			<dt>
				<Text as="span" size="xs" tone="muted" className="block truncate">
					{label}
				</Text>
			</dt>
			<dd
				className={cn(
					"font-display mt-2 text-5xl leading-none font-semibold tracking-[-0.05em] tabular-nums sm:text-6xl",
					value > 0 && activeClassName ? activeClassName : "text-foreground",
				)}
			>
				{value}
			</dd>
		</div>
	);
}
