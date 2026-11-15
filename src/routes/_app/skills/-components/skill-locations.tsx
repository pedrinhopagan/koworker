import { Check, HardDrive, Link2, TriangleAlert } from "lucide-react";

import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SKILL_TOOL_LABEL } from "@/constants/skills";
import { cn } from "@/lib/utils";
import type { SkillDetail, SkillLocation, SkillVariant } from "@/types/skills";

function variantLabel(
	variant: Pick<SkillLocation, "tool" | "scope"> & { projectName?: string | null },
) {
	const scope =
		variant.scope === "project"
			? ` · ${variant.projectName ?? "projeto"}`
			: variant.scope === "custom"
				? " · custom"
				: "";

	return `${SKILL_TOOL_LABEL[variant.tool]}${scope}`;
}

export function SkillLocations({
	variants,
	locations,
	activePath,
	missingTools,
	standardizing,
	conflictNature,
	onSelect,
	onStandardize,
}: {
	conflictNature: string | null;
	variants: SkillVariant[];
	locations: SkillLocation[];
	activePath: string;
	missingTools: SkillDetail["missingTools"];
	standardizing: boolean;
	onSelect: (path: string) => void;
	onStandardize: () => void;
}) {
	const active = variants.find((variant) => variant.path === activePath) ?? variants[0];
	if (!active) return null;

	const everywhere =
		locations.length > 0
			? locations
			: variants.map((variant) => ({
					...variant,
					linked: variant.dir !== variant.canonicalRoot,
					projectName: null,
				}));
	const synced = everywhere.filter((location) => location.contentHash === active.contentHash);
	const divergent = everywhere.filter((location) => location.contentHash !== active.contentHash);
	const selectable = new Set(variants.map((variant) => variant.path));
	const needsAttention = divergent.length > 0 || missingTools.length > 0;

	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					data-slot="skill-locations"
					className={cn(
						"flex h-6 items-center gap-1.5 border px-2 text-xs transition-colors",
						needsAttention
							? "border-amber-500/50 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
							: "border-border text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
					)}
				>
					{needsAttention ? <TriangleAlert className="size-3" /> : <HardDrive className="size-3" />}
					<span>
						{variantLabel(active)}
						{synced.length > 1 && ` +${synced.length - 1}`}
					</span>
					{divergent.length > 0 && (
						<span>
							· {divergent.length} {divergent.length === 1 ? "diverge" : "divergem"}
						</span>
					)}
				</button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-[min(32rem,calc(100vw-2rem))] p-0">
				<div className="border-b border-border px-3 py-2">
					<Text size="xs" className="font-medium">
						Salvar grava em {synced.length} {synced.length === 1 ? "local" : "locais"}
					</Text>
					<Text size="xs" tone="muted">
						Toda cópia idêntica a esta é atualizada junto, em qualquer projeto ou pasta.
					</Text>
					{divergent.length > 0 && conflictNature && (
						<Text size="xs" className="mt-1 text-amber-600 dark:text-amber-400">
							{conflictNature}: as versões diferentes não recebem a edição.
						</Text>
					)}
				</div>
				<ul className="max-h-64 overflow-y-auto py-1">
					{[...synced, ...divergent].map((location) => {
						const isActive = location.path === active.path;
						const isDivergent = location.contentHash !== active.contentHash;
						const canSelect = selectable.has(location.path);
						return (
							<li key={location.path}>
								<button
									type="button"
									disabled={!canSelect}
									onClick={() => onSelect(location.path)}
									className={cn(
										"flex w-full items-start gap-2 px-3 py-1.5 text-left transition-colors enabled:hover:bg-secondary/60 disabled:cursor-default",
										isActive && "bg-secondary/40",
									)}
								>
									<span className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center">
										{isActive && <Check className="size-3.5" />}
										{!isActive && isDivergent && (
											<TriangleAlert className="size-3 text-amber-500" />
										)}
									</span>
									<span className="min-w-0 flex-1">
										<span className="flex items-center gap-1.5 text-xs">
											{variantLabel(location)}
											{location.linked && (
												<Link2 className="size-3 text-muted-foreground" aria-label="link" />
											)}
											{isDivergent && (
												<span className="text-amber-600 dark:text-amber-400">versão diferente</span>
											)}
										</span>
										<span className="block truncate font-mono text-[11px] text-muted-foreground">
											{location.dir}
										</span>
									</span>
								</button>
							</li>
						);
					})}
				</ul>
				{missingTools.length > 0 && (
					<div className="border-t border-border px-3 py-2">
						<Text size="xs" tone="muted">
							Falta em {missingTools.map((tool) => SKILL_TOOL_LABEL[tool]).join(", ")}
						</Text>
					</div>
				)}
				{needsAttention && (
					<div className="flex justify-end border-t border-border px-3 py-2">
						<Button
							size="compact"
							variant="outline"
							disabled={standardizing}
							onClick={onStandardize}
						>
							<Check className="size-3.5" />
							Igualar todas a esta versão
						</Button>
					</div>
				)}
			</PopoverContent>
		</Popover>
	);
}
