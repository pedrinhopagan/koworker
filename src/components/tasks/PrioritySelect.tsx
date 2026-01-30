import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown } from "lucide-react";

import { orpc } from "@/client";
import { CustomSelect } from "@/components/ui/custom-select";
import { cn } from "@/lib/utils";

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
		<span className={cn("inline-flex items-center gap-2", sizeClasses)}>
			<span className="size-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
			<span className="truncate text-foreground">{label}</span>
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
	// Fetch priorities internally
	const prioritiesQuery = useQuery(orpc.priorities.list.queryOptions());
	const priorities = (prioritiesQuery.data ?? []) as Priority[];

	const selectedPriority = priorities.find((p) => p.id === value) ?? null;
	const accentColor = selectedPriority?.color ?? "#6b7280";

	// Build items for CustomSelect
	const selectItems = priorities.map((priority) => ({
		id: priority.id,
		name: priority.name,
		level: priority.level,
		color: priority.color,
		displayOrder: priority.displayOrder,
	}));

	return (
		<CustomSelect
			items={selectItems}
			value={value ?? undefined}
			onValueChange={(newValue, item) => {
				onValueChange(newValue, item as Priority);
			}}
			disabled={disabled || prioritiesQuery.isLoading}
			variant="default"
			size="md"
			label="Prioridade"
			renderTrigger={() => (
				<>
					<PriorityChip priority={selectedPriority} placeholder={placeholder} />
					<ChevronDown className="size-4 text-muted-foreground ml-1" />
				</>
			)}
			renderItem={(item, isSelected) => {
				const color = item.color ?? "#6b7280";

				return (
					<div
						className={cn(
							"w-full px-3 py-2 flex items-center gap-2",
							"transition-all duration-150 ease-out",
							isSelected ? "bg-popover" : "hover:bg-popover",
						)}
						style={{
							borderLeft: isSelected ? `2px solid ${color}` : "2px solid transparent",
						}}
					>
						<span className="size-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
						<span
							className={cn(
								"flex-1 text-sm truncate",
								isSelected ? "text-foreground font-medium" : "text-foreground",
							)}
						>
							{item.name}
						</span>
						<span className="text-xs text-muted-foreground tabular-nums">{item.level}</span>

						{isSelected && <Check className="size-4 ml-auto shrink-0" style={{ color }} />}
					</div>
				);
			}}
			triggerStyle={{
				boxShadow: `0 0 0 1px ${accentColor}30`,
			}}
			triggerClassName={cn("gap-1 min-w-[140px]", triggerClassName)}
			contentClassName="min-w-[180px]"
		/>
	);
}

// ============================================================================
// Exports
// ============================================================================

export { PriorityChip };
export type { PriorityChipProps };
