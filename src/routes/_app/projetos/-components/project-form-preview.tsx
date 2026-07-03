import { CheckCircle2, FolderKanban, FolderOpen, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import { Text, Title } from "@/components/typography";
import { cn } from "@/lib/utils";
import type { ProjectFormValues } from "./project-form";
import { defaultProjectColor } from "@/constants/colors";

type ProjectFormPreviewProps = {
	mode: "create" | "edit";
};

export function ProjectFormPreview({ mode }: ProjectFormPreviewProps) {
	const { control } = useFormContext<ProjectFormValues>();
	const values = useWatch({ control, name: ["name", "description", "mainRoute", "color"] });
	const [name, description, mainRoute, color] = values;

	const accentColor = color || defaultProjectColor;
	const displayName = name?.trim() || "Projeto sem nome";
	const displayRoute = mainRoute?.trim() || "~/projetos/meu-app";
	const displayDescription =
		description?.trim() || "Descreva o objetivo e o escopo principal do projeto";

	const highlightStyle = useMemo(
		() => ({
			borderColor: `${accentColor}60`,
			boxShadow: `0 0 0 1px ${accentColor}25, 0 0 20px ${accentColor}20`,
		}),
		[accentColor],
	);

	return (
		<section className="space-y-4">
			<div className="rounded-lg border border-border bg-card/40 p-4" style={highlightStyle}>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span className="size-2 rounded-full" style={{ backgroundColor: accentColor }} />
						<Text size="xs" tone="muted" className="uppercase tracking-widest">
							Preview do app
						</Text>
					</div>
					<Text size="xs" tone="muted" className="uppercase tracking-widest">
						{mode === "create" ? "Criar" : "Editar"}
					</Text>
				</div>

				<div className="mt-4 space-y-4">
					<div className="rounded-md border border-border/70 bg-background/40 p-3">
						<Text size="xs" tone="muted" className="uppercase tracking-wide">
							Tarefas (idle, IA trabalhando, concluída)
						</Text>
						<div className="mt-3 space-y-2">
							<PreviewTask
								accentColor={accentColor}
								label="Melhorar fluxo de criação de projeto"
								badge="2"
								status="idle"
							/>
							<PreviewTask
								accentColor={accentColor}
								label="IA trabalhando"
								badge="1"
								status="working"
							/>
							<PreviewTask
								accentColor={accentColor}
								label="Criar formulário de projeto"
								badge="feature"
								status="done"
							/>
						</div>
					</div>

					<div className="rounded-md border border-border/70 bg-background/40 p-3">
						<Text size="sm" tone="muted" className="uppercase tracking-wide">
							Card compacto
						</Text>
						<div className="mt-3 flex items-center gap-3 rounded-md border border-border/60 bg-muted/40 px-3 py-2">
							<div
								className="size-8 rounded-md flex items-center justify-center"
								style={{ backgroundColor: `${accentColor}25` }}
							>
								<FolderKanban className="size-4" style={{ color: accentColor }} />
							</div>
							<div>
								<Title size="sm" as="div">
									{displayName}
								</Title>
								<Text size="xs" tone="muted">
									Personalizada
								</Text>
							</div>
						</div>
					</div>

					<div className="rounded-md border border-border/70 bg-background/40 p-3">
						<Text size="sm" tone="muted" className="uppercase tracking-wide">
							Resumo do projeto
						</Text>
						<div className="mt-3 space-y-3">
							<div className="flex items-center gap-2">
								<span className="size-2 rounded-full" style={{ backgroundColor: accentColor }} />
								<Title size="sm" as="div">
									{displayName}
								</Title>
							</div>
							<div className="flex items-center gap-2 text-xs text-muted-foreground">
								<FolderOpen className="size-3" />
								<span className="truncate">{displayRoute}</span>
							</div>
							<Text size="xs" tone="muted">
								{displayDescription}
							</Text>
							<div className="flex flex-wrap items-center gap-4">
								<StatusPill icon={Sparkles} label="IA executando" />
								<StatusPill icon={CheckCircle2} label="Concluída" />
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

function PreviewTask({
	accentColor,
	label,
	badge,
	status,
}: {
	accentColor: string;
	label: string;
	badge: string;
	status: "idle" | "working" | "done";
}) {
	const statusStyles = {
		idle: "border-l-muted-foreground/60",
		working: "border-l-amber-400/80 bg-amber-400/10",
		done: "border-l-emerald-400/80 opacity-80",
	} as const;

	return (
		<div
			className={cn(
				"flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs",
				"border-l-2",
				statusStyles[status],
			)}
			style={{ borderLeftColor: accentColor }}
		>
			<Text size="xs" className="truncate">
				{label}
			</Text>
			<span
				className={cn(
					"rounded-sm px-2 py-0.5 text-[10px] uppercase tracking-wide",
					status === "working" && "bg-amber-500/20 text-amber-700 dark:text-amber-200",
					status === "done" && "bg-emerald-500/20 text-emerald-700 dark:text-emerald-200",
					status === "idle" && "bg-muted text-muted-foreground",
				)}
			>
				{badge}
			</span>
		</div>
	);
}

function StatusPill({ icon: Icon, label }: { icon: typeof Sparkles; label: string }) {
	return (
		<div className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
			<Icon className="size-3" />
			<span>{label}</span>
		</div>
	);
}
