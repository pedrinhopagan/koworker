import { AlertTriangle, ArrowRight, CheckCircle2, FileWarning, ShieldCheck } from "lucide-react";

import type { RouterOutputs } from "@/client";
import { Text, Title } from "@/components/typography";
import { Badge, type BadgeVariant } from "@/components/ui/badge";

type Plan = RouterOutputs["taskStorage"]["preview"];
type PlanItem = Plan["items"][number];

const kindPresentation: Record<PlanItem["kind"], { label: string; variant: BadgeVariant }> = {
	correct: { label: "Correto", variant: "success" },
	flat_migratable: { label: "Pronto para migrar", variant: "secondary" },
	nested_compatible: { label: "Compatível", variant: "secondary" },
	missing_folder: { label: "Pasta ausente", variant: "destructive" },
	source_destination_identical: { label: "Cópia idêntica", variant: "warning" },
	source_destination_divergent: { label: "Conteúdo divergente", variant: "destructive" },
	feature_missing: { label: "Feature ausente", variant: "destructive" },
	feature_cross_project: { label: "Feature de outro projeto", variant: "destructive" },
	unsafe_path: { label: "Path inseguro", variant: "destructive" },
	soft_deleted_reappeared: { label: "Exclusão reapareceu", variant: "destructive" },
	identity_missing: { label: "Identidade incompleta", variant: "destructive" },
	version_unknown: { label: "Versão desconhecida", variant: "destructive" },
};

function formatBytes(value: number) {
	if (value < 1024) return `${value} B`;
	if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
	return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function TaskStoragePreview({ plan }: { plan: Plan }) {
	const canApply = plan.totals.blocked === 0 && plan.totals.orphaned === 0;

	return (
		<div className="grid gap-4">
			<div className="grid grid-cols-2 border border-border bg-muted/20 sm:grid-cols-4">
				{[
					["A mover", plan.totals.toApply],
					["Corretas", plan.totals.correct],
					["Bloqueios", plan.totals.blocked],
					["Órfãs", plan.totals.orphaned],
				].map(([label, value]) => (
					<div key={label} className="border-border px-3 py-3 not-last:border-r">
						<Text size="xs" tone="muted" className="uppercase tracking-[0.12em]">
							{label}
						</Text>
						<Title as="span" size="lg" className="mt-1 block tabular-nums">
							{value}
						</Title>
					</div>
				))}
			</div>

			<div className="flex items-start gap-3 border border-border bg-card px-4 py-3">
				{canApply ? (
					<ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
				) : (
					<AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
				)}
				<div className="min-w-0">
					<Text className="font-medium">
						{canApply ? "Plano verificável" : "Aplicação bloqueada"}
					</Text>
					<Text size="xs" tone="muted" className="mt-0.5">
						{canApply
							? "O apply refaz este diagnóstico, cria snapshot e preserva cada origem antes de publicar o novo layout."
							: "Resolva os conflitos e importe ou trate as pastas órfãs antes de aplicar o layout."}
					</Text>
				</div>
			</div>

			<div className="grid gap-2">
				{plan.items.map((item) => {
					const presentation = kindPresentation[item.kind];
					const size = item.source?.size ?? item.destination?.size;
					return (
						<div key={item.taskId} className="border border-border bg-card px-4 py-3">
							<div className="flex flex-wrap items-start justify-between gap-2">
								<div className="min-w-0">
									<Text className="truncate font-medium">{item.title}</Text>
									<Text size="xs" tone="muted" className="mt-0.5 font-mono">
										{item.storageKey ?? item.taskId}
										{size !== undefined && ` · ${formatBytes(size)}`}
									</Text>
								</div>
								<Badge variant={presentation.variant}>{presentation.label}</Badge>
							</div>
							{item.destinationPath && item.sourcePath !== item.destinationPath && (
								<div className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-[1fr_auto_1fr] sm:items-center">
									<span className="truncate font-mono">{item.sourcePath}</span>
									<ArrowRight className="size-3.5" />
									<span className="truncate font-mono text-foreground">{item.destinationPath}</span>
								</div>
							)}
						</div>
					);
				})}
			</div>

			{plan.orphans.length > 0 && (
				<div className="border border-destructive/40 bg-destructive/5 p-4">
					<div className="flex items-center gap-2">
						<FileWarning className="size-4 text-destructive" />
						<Text className="font-medium">Pastas sem registro</Text>
					</div>
					<div className="mt-2 grid gap-1">
						{plan.orphans.map((orphan) => (
							<Text key={orphan.folderPath} size="xs" className="font-mono">
								{orphan.folderPath}
							</Text>
						))}
					</div>
				</div>
			)}

			{canApply && plan.totals.toApply === 0 && plan.fromLayoutVersion !== plan.toLayoutVersion && (
				<div className="border border-primary/30 bg-primary/5 p-4">
					<Text className="font-medium">Pronto para ativar o layout novo.</Text>
					<Text size="xs" tone="muted" className="mt-1 font-mono">
						Hash {plan.planHash} · layout {plan.fromLayoutVersion} → {plan.toLayoutVersion}
					</Text>
				</div>
			)}

			{plan.totals.toApply === 0 &&
				plan.totals.blocked === 0 &&
				plan.totals.orphaned === 0 &&
				plan.fromLayoutVersion === plan.toLayoutVersion && (
					<div className="flex items-center gap-2 border border-primary/30 bg-primary/5 p-4">
						<CheckCircle2 className="size-5 text-primary" />
						<Text className="font-medium">O storage já está reconciliado.</Text>
					</div>
				)}
		</div>
	);
}
