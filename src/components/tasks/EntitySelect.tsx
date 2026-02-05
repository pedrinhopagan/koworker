import type { UseQueryResult } from "@tanstack/react-query";
import { Check, ChevronDown, Settings2 } from "lucide-react";
import type { ReactNode } from "react";

import { CustomSelect } from "@/components/ui/custom-select";
import { cn } from "@/lib/utils";
import type { ManageDrawerKey } from "@/stores/manage-drawers";
import { useManageDrawerStore } from "@/stores/manage-drawers";

type BaseEntityItem = {
	id: string;
	name: string;
	color: string | null;
};

type EntityChipProps<T extends BaseEntityItem> = {
	entity: T | null;
	size?: "sm" | "md";
	placeholder?: string;
	renderExtra?: (entity: T) => ReactNode;
};

export function EntityChip<T extends BaseEntityItem>({
	entity,
	size = "md",
	placeholder,
	renderExtra,
}: EntityChipProps<T>) {
	const color = entity?.color ?? "#6b7280";
	const label = entity?.name ?? placeholder;
	const sizeClasses = size === "sm" ? "text-xs" : "text-sm";

	return (
		<span className={cn("inline-flex items-center gap-2 min-w-0", sizeClasses)}>
			<span className="size-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
			<span className="truncate text-foreground min-w-0">{label}</span>
			{entity && renderExtra?.(entity)}
		</span>
	);
}

type EntitySelectConfig<T extends BaseEntityItem> = {
	entityName: string;
	entityNamePlural: string;
	manageActionId: string;
	manageDrawerKey: ManageDrawerKey;
	label: string;
	placeholder: string;
	loadErrorMessage: string;
	emptyMessage: string;
	manageLabel: string;
	renderExtra?: (entity: T) => ReactNode;
	renderItemExtra?: (entity: T) => ReactNode;
	contentMinWidth?: string;
};

type EntitySelectProps<T extends BaseEntityItem> = {
	config: EntitySelectConfig<T>;
	listQuery: UseQueryResult<T[], Error>;
	value: string | null;
	onValueChange: (id: string, entity: T) => void;
	disabled?: boolean;
	triggerClassName?: string;
	upperLabel?: boolean;
	managerDrawer: ReactNode;
};

export function EntitySelect<T extends BaseEntityItem>({
	config,
	listQuery,
	value,
	onValueChange,
	disabled = false,
	triggerClassName,
	upperLabel = false,
	managerDrawer,
}: EntitySelectProps<T>) {
	const openManageDrawer = useManageDrawerStore((s) => s.open);
	const entities = (listQuery.data ?? []) as T[];

	const loadError = listQuery.isError ? config.loadErrorMessage : null;

	const selectedEntity = entities.find((e) => e.id === value) ?? null;
	const accentColor = selectedEntity?.color ?? "#6b7280";

	const selectItems: (T & { id: string })[] = [
		...entities,
		{
			id: config.manageActionId,
			name: config.manageLabel,
			color: null,
		} as T,
	];

	return (
		<>
			<CustomSelect
				items={selectItems}
				value={value ?? undefined}
				onValueChange={(newValue, item) => {
					if (newValue === config.manageActionId) {
						openManageDrawer(config.manageDrawerKey);
						return;
					}
					onValueChange(newValue, item as T);
				}}
				disabled={disabled}
				loading={listQuery.isLoading}
				error={loadError}
				emptyMessage={loadError ? "" : config.emptyMessage}
				variant="default"
				size="md"
				label={config.label}
				upperLabel={upperLabel}
				renderTrigger={() => (
					<>
						<span className="flex-1 flex min-w-0">
							<EntityChip
								entity={selectedEntity}
								placeholder={config.placeholder}
								renderExtra={config.renderExtra}
							/>
						</span>
						<ChevronDown className="size-4 text-muted-foreground ml-1 shrink-0" />
					</>
				)}
				renderItem={(item, isSelected) => {
					if (item.id === config.manageActionId) {
						return (
							<div className="w-full px-3 py-2 flex items-center gap-2 text-sm text-current opacity-70">
								<Settings2 className="size-4" />
								<span className="truncate">{config.manageLabel}</span>
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
							<span className="size-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
							<span className={cn("flex-1 text-sm truncate", isSelected && "font-medium")}>
								{item.name}
							</span>
							{config.renderItemExtra?.(item)}
							{isSelected && <Check className="size-4 ml-auto shrink-0" style={{ color }} />}
						</div>
					);
				}}
				itemClassName={(item) =>
					item.id === config.manageActionId
						? "sticky bottom-0 z-10 border-t border-border bg-card"
						: ""
				}
				triggerStyle={{
					boxShadow: `0 0 0 1px ${accentColor}30`,
				}}
				triggerClassName={cn("gap-1 min-w-[140px]", triggerClassName)}
				contentClassName={config.contentMinWidth ?? "min-w-[var(--radix-select-trigger-width)]"}
			/>
			{managerDrawer}
		</>
	);
}
