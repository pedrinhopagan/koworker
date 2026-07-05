import type { RouterOutputs } from "@/client";
import { Text, Title } from "@/components/typography";

type HomeProject = NonNullable<RouterOutputs["projects"]["getById"]>;

type HomeProjectShowcaseProps = {
	project: HomeProject;
};

const numberFmt = new Intl.NumberFormat("pt-BR");

export function HomeProjectShowcase({ project }: HomeProjectShowcaseProps) {
	const accentColor = project.color ?? "var(--primary)";
	const pending = project.tasksSummary.pending ?? 0;
	const done = project.tasksSummary.done ?? 0;

	return (
		<div className="mx-auto flex h-full min-h-[28rem] w-full max-w-4xl flex-col justify-center px-2 pb-10 md:min-h-[34rem] md:px-4">
			<div className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">
				<span className="size-2 shrink-0" style={{ backgroundColor: accentColor }} />
				Projeto em foco
			</div>

			<Title
				as="h1"
				className="mt-6 text-5xl font-extrabold leading-[0.95] tracking-tight md:text-7xl"
			>
				{project.name}
			</Title>

			<div
				className="mt-8 h-px w-full"
				style={{ backgroundColor: `color-mix(in oklab, ${accentColor} 45%, var(--border))` }}
			/>

			<div className="mt-10 grid gap-px border border-border bg-border sm:grid-cols-2">
				<Metric label="Pendentes" value={pending} accentColor={accentColor} />
				<Metric label="Concluídas" value={done} accentColor={accentColor} />
			</div>
		</div>
	);
}

type MetricProps = {
	label: string;
	value: number;
	accentColor: string;
};

function Metric({ label, value, accentColor }: MetricProps) {
	return (
		<div className="bg-card px-6 py-7">
			<Text size="xs" tone="muted" className="uppercase tracking-[0.2em]">
				{label}
			</Text>
			<Title
				as="div"
				className="mt-3 text-5xl font-extrabold leading-none tabular-nums"
				style={{ color: accentColor }}
			>
				{numberFmt.format(value)}
			</Title>
		</div>
	);
}
