import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Cpu, Settings2 } from "lucide-react";

import { orpc } from "@/client";
import { CustomSelect } from "@/components/ui/custom-select";
import { cn } from "@/lib/utils";
import { useManageDrawerStore } from "@/stores/manage-drawers";

import { ModelManagerDrawer } from "./ModelManagerDrawer";

export type Model = {
	id: string;
	name: string;
	provider?: string;
	modelId?: string;
	color: string;
};

export type ModelSelectProps = {
	value: string | null;
	onValueChange: (modelId: string, model: Model) => void;
	disabled?: boolean;
	placeholder?: string;
	triggerClassName?: string;
};

const MANAGE_MODEL_ID = "__manage_model__";

type ModelChipProps = {
	model: Model | null;
	size?: "sm" | "md";
	placeholder?: string;
};

function ModelChip({ model, size = "md", placeholder = "Model" }: ModelChipProps) {
	const color = model?.color ?? "#6b7280";
	const label = model?.name ?? placeholder;

	const sizeClasses = size === "sm" ? "text-xs" : "text-sm";

	return (
		<span className={cn("inline-flex items-center gap-2", sizeClasses)}>
			<Cpu size={14} style={{ color }} />
			<span className="truncate text-foreground">{label}</span>
		</span>
	);
}

export function ModelSelect({
	value,
	onValueChange,
	disabled = false,
	placeholder = "Model",
	triggerClassName,
}: ModelSelectProps) {
	const openManageDrawer = useManageDrawerStore((s) => s.open);
	const modelsQuery = useQuery(orpc.models.list.queryOptions());
	const models = (modelsQuery.data ?? []) as Model[];

	const loadError = modelsQuery.isError ? "Não foi possível carregar models" : null;

	const selectedModel = models.find((m) => m.id === value) ?? null;
	const accentColor = selectedModel?.color ?? "#6b7280";

	const selectItems = [
		...models.map((model) => ({
			id: model.id,
			name: model.name,
			provider: model.provider,
			modelId: model.modelId,
			color: model.color,
		})),
		{
			id: MANAGE_MODEL_ID,
			name: "Gerenciar models",
			color: "#6b7280",
		},
	];

	return (
		<>
			<CustomSelect
				items={selectItems}
				value={value ?? undefined}
				onValueChange={(newValue, item) => {
					if (newValue === MANAGE_MODEL_ID) {
						openManageDrawer("models");
						return;
					}
					onValueChange(newValue, item as Model);
				}}
				disabled={disabled}
				loading={modelsQuery.isLoading}
				error={loadError}
				emptyMessage={loadError ? "" : "Nenhum model"}
				variant="default"
				size="md"
				label="Model"
				upperLabel
				renderTrigger={() => (
					<>
						<ModelChip model={selectedModel} placeholder={placeholder} />
						<ChevronDown className="size-4 text-muted-foreground ml-1" />
					</>
				)}
				renderItem={(item, isSelected) => {
					if (item.id === MANAGE_MODEL_ID) {
						return (
							<div className="w-full px-3 py-2 flex items-center gap-2 text-sm text-current opacity-70">
								<Settings2 className="size-4" />
								<span className="truncate">Gerenciar models</span>
							</div>
						);
					}

					const color = item.color ?? "#6b7280";

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
							<Cpu size={14} style={{ color }} />
							<span className={cn("flex-1 text-sm truncate", isSelected && "font-medium")}>
								{item.name}
							</span>

							{isSelected && <Check className="size-4 ml-auto shrink-0" style={{ color }} />}
						</div>
					);
				}}
				itemClassName={(item) =>
					item.id === MANAGE_MODEL_ID ? "sticky bottom-0 z-10 border-t border-border bg-card" : ""
				}
				triggerStyle={{
					boxShadow: `0 0 0 1px ${accentColor}30`,
				}}
				triggerClassName={cn("gap-1 min-w-[140px]", triggerClassName)}
				contentClassName="min-w-[180px]"
			/>
			<ModelManagerDrawer />
		</>
	);
}

export { ModelChip };
export type { ModelChipProps };
