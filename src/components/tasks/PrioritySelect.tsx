import { useQuery } from "@tanstack/react-query";
import { ListOrdered } from "lucide-react";

import { orpc } from "@/client";
import { EntityChip, EntitySelect } from "./EntitySelect";
import { PriorityManagerDrawer } from "./PriorityManagerDrawer";

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
	upperLabel?: boolean;
	compact?: boolean;
};

export type PriorityChipProps = {
	priority: Priority | null;
	size?: "sm" | "md";
	placeholder?: string;
	showLevel?: boolean;
};

export function PriorityChip({
	priority,
	size = "md",
	placeholder = "Prioridade",
	showLevel = false,
}: PriorityChipProps) {
	return (
		<EntityChip
			entity={priority}
			size={size}
			placeholder={placeholder}
			renderExtra={
				showLevel
					? (p) => <span className="text-xs text-muted-foreground">{p.level}</span>
					: undefined
			}
		/>
	);
}

const prioritySelectConfig = {
	entityName: "prioridade",
	entityNamePlural: "prioridades",
	manageActionId: "__manage_priority__",
	manageDrawerKey: "priorities" as const,
	label: "Prioridade",
	placeholder: "Prioridade",
	loadErrorMessage: "Não foi possível carregar prioridades",
	emptyMessage: "Nenhuma prioridade",
	manageLabel: "Gerenciar prioridades",
	renderItemExtra: (p: Priority) => (
		<span className="text-xs tabular-nums opacity-70">{p.level}</span>
	),
	contentMinWidth: "min-w-[var(--radix-select-trigger-width)]",
	triggerIcon: <ListOrdered className="size-4" />,
};

export function PrioritySelect({
	value,
	onValueChange,
	disabled = false,
	placeholder = "Prioridade",
	triggerClassName,
	upperLabel = false,
	compact = false,
}: PrioritySelectProps) {
	const listQuery = useQuery(orpc.priorities.list.queryOptions());

	return (
		<EntitySelect<Priority>
			config={{ ...prioritySelectConfig, placeholder }}
			listQuery={listQuery}
			value={value}
			onValueChange={onValueChange}
			disabled={disabled}
			triggerClassName={triggerClassName}
			upperLabel={upperLabel}
			compact={compact}
			managerDrawer={<PriorityManagerDrawer />}
		/>
	);
}
