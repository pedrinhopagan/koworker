import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Settings2 } from "lucide-react";
import { orpc } from "@/client";
import { CustomSelect } from "@/components/ui/custom-select";
import { cn } from "@/lib/utils";
import { useManageDrawerStore } from "@/stores/manage-drawers";
import { PriorityManagerDrawer } from "./PriorityManagerDrawer";

// ============================================================================
// Types
// ============================================================================

export type Priority = {
	id: string;
	name: string;
	level: number;
	color: string;
	displayOrder: number;
};

export type PrioritySelectProps = {
	value: string | null;
	onValueChange: (priorityId: string, priority: Priority) => void;
	disabled?: boolean;
	placeholder?: string;
	triggerClassName?: string;
};

const MANAGE_PRIORITY_ID = "__manage_priority__";

// ============================================================================
// Priority Chip (reusable visual component)
// ============================================================================

type PriorityChipProps = {
	priority: Priority | null;
	size?: "sm" | "md";
	placeholder?: string;
	showLevel?: boolean;
};

function PriorityChip({
	priority,
	size = "md",
	placeholder = "Prioridade",
	showLevel = false,
}: PriorityChipProps) {
	const color = priority?.color ?? "#6b7280";
	const label = priority?.name ?? placeholder;

	const sizeClasses = size === "sm" ? "text-xs" : "text-sm";

	return (
		<span className={cn("inline-flex items-center gap-2 min-w-0", sizeClasses)}>
			<span className="size-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
			<span className="truncate text-foreground min-w-0">{label}</span>
			{showLevel && priority && (
				<span className="text-xs text-muted-foreground">{priority.level}</span>
			)}
		</span>
	);
}

// ============================================================================
// PrioritySelect Component
// ============================================================================

export function PrioritySelect({
	value,
	onValueChange,
	disabled = false,
	placeholder = "Prioridade",
	triggerClassName,
}: PrioritySelectProps) {
	const openManageDrawer = useManageDrawerStore((s) => s.open);
	// Fetch priorities internally
	const prioritiesQuery = useQuery(orpc.priorities.list.queryOptions());
	const priorities = (prioritiesQuery.data ?? []) as Priority[];

	const loadError = prioritiesQuery.isError ? "Não foi possível carregar prioridades" : null;

	const selectedPriority = priorities.find((p) => p.id === value) ?? null;
	const accentColor = selectedPriority?.color ?? "#6b7280";

	// Build items for CustomSelect
	const selectItems = [
		...priorities.map((priority) => ({
			id: priority.id,
			name: priority.name,
			level: priority.level,
			color: priority.color,
			displayOrder: priority.displayOrder,
		})),
		{
			id: MANAGE_PRIORITY_ID,
			name: "Gerenciar prioridades",
			level: 0,
			color: "#6b7280",
			displayOrder: Number.POSITIVE_INFINITY,
		},
	];

	return (
		<>
			<CustomSelect
				items={selectItems}
				value={value ?? undefined}
				onValueChange={(newValue, item) => {
					if (newValue === MANAGE_PRIORITY_ID) {
						openManageDrawer("priorities");
						return;
					}
					onValueChange(newValue, item as Priority);
				}}
				disabled={disabled}
				loading={prioritiesQuery.isLoading}
				error={loadError}
				emptyMessage={loadError ? "" : "Nenhuma prioridade"}
				variant="default"
				size="md"
				label="Prioridade"
				renderTrigger={() => (
					<>
						<span className="flex-1 flex min-w-0">
							<PriorityChip priority={selectedPriority} placeholder={placeholder} />
						</span>
						<ChevronDown className="size-4 text-muted-foreground ml-1 shrink-0" />
					</>
				)}
				renderItem={(item, isSelected) => {
					if (item.id === MANAGE_PRIORITY_ID) {
						return (
							<div className="w-full px-3 py-2 flex items-center gap-2 text-sm text-current opacity-70">
								<Settings2 className="size-4" />
								<span className="truncate">Gerenciar prioridades</span>
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
							<span className="text-xs tabular-nums opacity-70">{item.level}</span>

							{isSelected && <Check className="size-4 ml-auto shrink-0" style={{ color }} />}
						</div>
					);
				}}
				itemClassName={(item) =>
					item.id === MANAGE_PRIORITY_ID
						? "sticky bottom-0 z-10 border-t border-border bg-card"
						: ""
				}
				triggerStyle={{
					boxShadow: `0 0 0 1px ${accentColor}30`,
				}}
				triggerClassName={cn("gap-1 min-w-[140px]", triggerClassName)}
				contentClassName="min-w-[var(--radix-select-trigger-width)]"
			/>
			<PriorityManagerDrawer />
		</>
	);
}

// ============================================================================
// Exports
// ============================================================================

export { PriorityChip };
export type { PriorityChipProps };
