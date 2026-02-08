import { CheckCircle2, FolderKanban, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { RouterOutputs } from "@/client";
import { InlineTaskCreateForm, type InlineTaskCreateFormSubmitInput } from "@/components/tasks";
import { Text, Title } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type HomeProject = NonNullable<RouterOutputs["projects"]["getById"]>;

type HomeProjectShowcaseProps = {
	project: HomeProject;
	onCreateTask: (input: InlineTaskCreateFormSubmitInput) => void;
	creatingTask: boolean;
};

const percent = new Intl.NumberFormat("pt-BR");

const mix = (color: string, value: number) =>
	`color-mix(in oklab, ${color} ${Math.max(0, Math.min(100, value))}%, transparent)`;

export function HomeProjectShowcase({
	project,
	onCreateTask,
	creatingTask,
}: HomeProjectShowcaseProps) {
	const accentColor = project.color ?? "hsl(var(--primary))";
	const pendingCount = (project.tasksSummary.pending ?? 0) + (project.tasksSummary.inProgress ?? 0);
	const doneCount = project.tasksSummary.done ?? 0;

	return (
		<div className="mx-auto flex h-full w-full max-w-6xl px-2 pb-6 md:px-4">
			<div className="grid h-full w-full gap-6 xl:grid-cols-[1.25fr_0.75fr]">
				<Card
					className="relative overflow-hidden border bg-card/70 p-6 backdrop-blur md:p-10"
					style={{
						borderColor: mix(accentColor, 34),
						backgroundImage: [
							`radial-gradient(circle at 14% 18%, ${mix(accentColor, 26)} 0%, transparent 48%)`,
							`radial-gradient(circle at 88% 12%, ${mix(accentColor, 19)} 0%, transparent 44%)`,
							`linear-gradient(145deg, ${mix(accentColor, 10)} 0%, transparent 62%)`,
						].join(","),
					}}
				>
					<div
						className="pointer-events-none absolute -left-24 -top-20 size-64 rounded-full blur-3xl"
						style={{ backgroundColor: mix(accentColor, 14) }}
					/>
					<div
						className="pointer-events-none absolute -right-10 -bottom-16 size-60 rounded-full blur-3xl"
						style={{ backgroundColor: mix(accentColor, 13) }}
					/>

					<div className="relative flex h-full flex-col justify-between gap-10">
						<div className="space-y-5">
							<Badge
								variant="outline"
								className="w-fit gap-2 border-current/30 bg-background/70 px-3 py-1"
							>
								<Sparkles className="size-3.5" style={{ color: accentColor }} />
								Projeto em foco
							</Badge>

							<Title as="h1" className="font-black leading-[0.88] text-4xl md:text-6xl">
								{project.name}
							</Title>

							<Title
								as="div"
								className="font-black tracking-[0.22em] text-[clamp(3rem,13vw,8.6rem)] leading-[0.85]"
								style={{ color: accentColor }}
							>
								KOWORK
							</Title>

							<Text className="max-w-2xl text-base text-muted-foreground md:text-lg">
								Ritmo de colab ativo: clareza no foco, espaço para respirar e energia visual guiada
								pela cor do seu projeto.
							</Text>
						</div>

						<div className="grid gap-3 sm:grid-cols-2">
							<MetricCard
								label="Tasks pendentes"
								value={pendingCount}
								accentColor={accentColor}
								icon={<FolderKanban className="size-4" />}
							/>
							<MetricCard
								label="Tasks concluídas"
								value={doneCount}
								accentColor={accentColor}
								icon={<CheckCircle2 className="size-4" />}
							/>
						</div>
					</div>
				</Card>

				<div className="grid gap-6 md:grid-cols-2 xl:grid-cols-1">
					<Card className="flex flex-col items-center justify-center gap-6 border border-border/70 bg-card/70 px-6 py-10 text-center backdrop-blur">
						<div
							className="grid size-36 place-items-center rounded-full border"
							style={{
								borderColor: mix(accentColor, 32),
								background: `radial-gradient(circle at 35% 35%, ${mix(accentColor, 28)} 0%, ${mix(accentColor, 8)} 68%)`,
							}}
						>
							<span
								aria-label="Kowork"
								className="size-24"
								style={{
									backgroundColor: accentColor,
									WebkitMaskImage: "url('/static/logo.svg')",
									maskImage: "url('/static/logo.svg')",
									WebkitMaskPosition: "center",
									maskPosition: "center",
									WebkitMaskRepeat: "no-repeat",
									maskRepeat: "no-repeat",
									WebkitMaskSize: "contain",
									maskSize: "contain",
									filter: "drop-shadow(0 8px 14px color-mix(in oklab, black 22%, transparent))",
								}}
							/>
						</div>
						<Title as="h2" className="text-2xl font-black tracking-[0.1em]">
							KOWORK
						</Title>
						<Text className="max-w-xs text-muted-foreground">
							Visão centralizada do seu fluxo de colaboração.
						</Text>
					</Card>

					<Card className="border border-border/70 bg-card/75 p-5 backdrop-blur md:p-6">
						<div className="mb-5 flex items-center justify-between gap-4">
							<div>
								<Title as="h2" size="lg" className="font-bold">
									Nova tarefa
								</Title>
								<Text size="sm" tone="muted">
									Crie uma tarefa sem sair da Home.
								</Text>
							</div>
							<Badge
								className="border-none"
								style={{ backgroundColor: mix(accentColor, 22), color: accentColor }}
							>
								Foco rápido
							</Badge>
						</div>

						<InlineTaskCreateForm
							onSubmit={onCreateTask}
							loading={creatingTask}
							projectId={project.id}
							variant="home"
						/>
					</Card>
				</div>
			</div>
		</div>
	);
}

type MetricCardProps = {
	label: string;
	value: number;
	accentColor: string;
	icon: ReactNode;
};

function MetricCard({ label, value, accentColor, icon }: MetricCardProps) {
	return (
		<div
			className="border px-4 py-4"
			style={{
				borderColor: mix(accentColor, 30),
				background: `linear-gradient(135deg, ${mix(accentColor, 12)} 0%, transparent 100%)`,
			}}
		>
			<div className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground">
				<span style={{ color: accentColor }}>{icon}</span>
				{label}
			</div>
			<Title as="div" className="text-4xl font-black leading-none">
				{percent.format(value)}
			</Title>
		</div>
	);
}
