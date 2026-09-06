import type { RouterOutputs } from "@/client";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

import { Text, Title } from "@/components/typography";
import { RadarStatusMark } from "@/components/ui/radar-status-mark";
import { useAgentRadar } from "@/hooks/use-agent-radar";
import { cn } from "@/lib/utils";

type HomeProject = NonNullable<RouterOutputs["projects"]["getById"]>;

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
	weekday: "short",
	day: "2-digit",
	month: "short",
	year: "numeric",
});

export const HOME_DOT_GRID =
	"bg-[radial-gradient(color-mix(in_oklab,var(--primary)_45%,transparent)_1px,transparent_1px)] bg-[size:14px_14px]";

export function HomeMasthead({ project }: { project: HomeProject }) {
	const { agents } = useAgentRadar();
	const blocked = agents.filter((agent) => agent.status === "blocked").length;
	const working = agents.filter((agent) => agent.status === "working").length;

	return (
		<section
			aria-label="Resumo do projeto"
			className="relative overflow-hidden border border-border bg-card shadow-xs"
		>
			<div
				aria-hidden
				className={cn(
					"pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_right,black_20%,transparent_75%)]",
					HOME_DOT_GRID,
				)}
			/>
			<div className="relative grid gap-8 p-6 sm:p-9 lg:grid-cols-12 lg:items-end">
				<div className="animate-stagger-fade-in min-w-0 lg:col-span-7">
					<Text
						size="xs"
						tone="muted"
						className="font-mono uppercase tracking-[0.18em] tabular-nums"
					>
						{dateFmt.format(new Date())} · briefing
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
					<Ledger label="Bloqueados" value={blocked} status="blocked" delay={80} />
					<Ledger label="Trabalhando" value={working} status="working" delay={140} />
					<Ledger label="Agents" value={agents.length} status="idle" delay={200} />
				</dl>
			</div>
			<Link
				to="/shells"
				className="relative flex items-center justify-between border-t border-border px-6 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground sm:px-9"
			>
				Abrir sala de agents <ArrowUpRight className="size-3.5" />
			</Link>
		</section>
	);
}

function Ledger({
	label,
	value,
	status,
	delay,
}: {
	label: string;
	value: number;
	status: "blocked" | "working" | "idle";
	delay: number;
}) {
	const active = value > 0 && status !== "idle";
	const tone = status === "blocked" ? "text-warning" : "text-primary";

	return (
		<div
			className="animate-stagger-fade-in min-w-0 px-4 pt-4 first:pl-0 lg:pt-0 lg:first:pl-8"
			style={{ animationDelay: `${delay}ms` }}
		>
			<dt className="flex items-center gap-2">
				<RadarStatusMark
					status={active ? status : "idle"}
					className={cn(active ? tone : "text-muted-foreground")}
				/>
				<Text as="span" size="xs" tone="muted" className="truncate">
					{label}
				</Text>
			</dt>
			<dd
				className={cn(
					"font-display mt-2 text-5xl leading-none font-semibold tracking-[-0.05em] tabular-nums sm:text-6xl",
					active ? tone : "text-foreground",
				)}
			>
				{value}
			</dd>
		</div>
	);
}
