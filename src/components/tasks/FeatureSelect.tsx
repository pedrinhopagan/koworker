import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Layers } from "lucide-react";

import { orpc, type RouterOutputs } from "@/client";
import { CustomSelect } from "@/components/ui/custom-select";
import { cn } from "@/lib/utils";

type Feature = RouterOutputs["taskGroups"]["list"][number];

// Feature é opcional na criação; este item representa "nenhuma feature" e mapeia para value null.
const NO_FEATURE_ID = "__no_feature__";

export type FeatureSelectProps = {
	projectId: string | null;
	value: string | null;
	onValueChange: (groupId: string | null) => void;
	disabled?: boolean;
	triggerClassName?: string;
	// Trigger reduzido: só o ícone (tingido pela cor selecionada) + chevron.
	compact?: boolean;
};

function FeatureChip({ feature }: { feature: Feature | null }) {
	const color = feature?.color ?? "#6b7280";
	const label = feature?.name ?? "Feature";

	return (
		<span className="inline-flex items-center gap-2 min-w-0 text-sm">
			<span className="size-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
			<span
				className={cn("truncate min-w-0", feature ? "text-foreground" : "text-muted-foreground")}
			>
				{label}
			</span>
		</span>
	);
}

export function FeatureSelect({
	projectId,
	value,
	onValueChange,
	disabled = false,
	triggerClassName,
	compact = false,
}: FeatureSelectProps) {
	const listQuery = useQuery({
		...orpc.taskGroups.list.queryOptions({ input: { projectId: projectId ?? "" } }),
		enabled: Boolean(projectId),
	});

	const features = (listQuery.data ?? []) as Feature[];
	const loadError = listQuery.isError ? "Não foi possível carregar features" : null;

	const selectedFeature = features.find((f) => f.id === value) ?? null;
	const accentColor = selectedFeature?.color ?? "#6b7280";

	const items: { id: string; name: string; color: string | null }[] = [
		{ id: NO_FEATURE_ID, name: "Sem feature", color: null },
		...features,
	];

	return (
		<CustomSelect
			items={items}
			value={value ?? NO_FEATURE_ID}
			onValueChange={(newValue) => {
				onValueChange(newValue === NO_FEATURE_ID ? null : newValue);
			}}
			disabled={disabled || !projectId}
			loading={listQuery.isLoading}
			error={loadError}
			emptyMessage={loadError ? "" : "Nenhuma feature"}
			variant="default"
			size="md"
			label="Feature"
			fitContent={compact}
			renderTrigger={() =>
				compact ? (
					<>
						<span
							className={cn("inline-flex shrink-0", !selectedFeature && "text-muted-foreground")}
							style={selectedFeature ? { color: accentColor } : undefined}
						>
							<Layers className="size-4" />
						</span>
						<ChevronDown className="size-4 text-muted-foreground shrink-0" />
						<span className="sr-only">Feature: {selectedFeature?.name ?? "Sem feature"}</span>
					</>
				) : (
					<>
						<span className="flex-1 flex min-w-0">
							<FeatureChip feature={selectedFeature} />
						</span>
						<ChevronDown className="size-4 text-muted-foreground ml-1 shrink-0" />
					</>
				)
			}
			renderItem={(item, isSelected) => {
				const color = item.color ?? "#6b7280";
				const isNone = item.id === NO_FEATURE_ID;

				return (
					<div
						className={cn(
							"w-full px-3 py-2 flex items-center gap-2",
							"transition-all duration-150 ease-out",
						)}
						style={{
							borderLeft: isSelected ? `2px solid ${color}` : "2px solid transparent",
						}}
					>
						<span className="size-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
						<span
							className={cn(
								"flex-1 text-sm truncate",
								isSelected && "font-medium",
								isNone && "text-muted-foreground",
							)}
						>
							{item.name}
						</span>
						{isSelected && <Check className="size-4 ml-auto shrink-0" style={{ color }} />}
					</div>
				);
			}}
			triggerStyle={{
				boxShadow: `0 0 0 1px ${accentColor}30`,
			}}
			triggerClassName={cn(
				"gap-1",
				compact ? "px-2 w-fit min-w-0" : "min-w-[140px]",
				triggerClassName,
			)}
			contentClassName={compact ? "min-w-[180px]" : "min-w-[var(--radix-select-trigger-width)]"}
		/>
	);
}
