import { useQuery } from "@tanstack/react-query";
import { Bot, Check, ChevronDown, Settings2 } from "lucide-react";

import { orpc } from "@/client";
import { CustomSelect } from "@/components/ui/custom-select";
import { cn } from "@/lib/utils";
import { useManageDrawerStore } from "@/stores/manage-drawers";

import { AgentManagerDrawer } from "./AgentManagerDrawer";

export type Agent = {
	id: string;
	name: string;
	description?: string;
	color: string;
};

export type AgentSelectProps = {
	value: string | null;
	onValueChange: (agentId: string, agent: Agent) => void;
	disabled?: boolean;
	placeholder?: string;
	triggerClassName?: string;
};

const MANAGE_AGENT_ID = "__manage_agent__";

type AgentChipProps = {
	agent: Agent | null;
	size?: "sm" | "md";
	placeholder?: string;
};

function AgentChip({ agent, size = "md", placeholder = "Agent" }: AgentChipProps) {
	const color = agent?.color ?? "#6b7280";
	const label = agent?.name ?? placeholder;

	const sizeClasses = size === "sm" ? "text-xs" : "text-sm";

	return (
		<span className={cn("inline-flex items-center gap-2", sizeClasses)}>
			<Bot size={14} style={{ color }} />
			<span className="truncate text-foreground">{label}</span>
		</span>
	);
}

export function AgentSelect({
	value,
	onValueChange,
	disabled = false,
	placeholder = "Agent",
	triggerClassName,
}: AgentSelectProps) {
	const openManageDrawer = useManageDrawerStore((s) => s.open);
	const agentsQuery = useQuery(orpc.agents.list.queryOptions());
	const agents = (agentsQuery.data ?? []) as Agent[];

	const loadError = agentsQuery.isError ? "Não foi possível carregar agents" : null;

	const selectedAgent = agents.find((a) => a.id === value) ?? null;
	const accentColor = selectedAgent?.color ?? "#6b7280";

	const selectItems = [
		...agents.map((agent) => ({
			id: agent.id,
			name: agent.name,
			description: agent.description,
			color: agent.color,
		})),
		{
			id: MANAGE_AGENT_ID,
			name: "Gerenciar agents",
			color: "#6b7280",
		},
	];

	return (
		<>
			<CustomSelect
				items={selectItems}
				value={value ?? undefined}
				onValueChange={(newValue, item) => {
					if (newValue === MANAGE_AGENT_ID) {
						openManageDrawer("agents");
						return;
					}
					onValueChange(newValue, item as Agent);
				}}
				disabled={disabled}
				loading={agentsQuery.isLoading}
				error={loadError}
				emptyMessage={loadError ? "" : "Nenhum agent"}
				variant="default"
				size="md"
				label="Agent"
				upperLabel
				renderTrigger={() => (
					<>
						<AgentChip agent={selectedAgent} placeholder={placeholder} />
						<ChevronDown className="size-4 text-muted-foreground ml-1" />
					</>
				)}
				renderItem={(item, isSelected) => {
					if (item.id === MANAGE_AGENT_ID) {
						return (
							<div className="w-full px-3 py-2 flex items-center gap-2 text-sm text-current opacity-70">
								<Settings2 className="size-4" />
								<span className="truncate">Gerenciar agents</span>
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
							<Bot size={14} style={{ color }} />
							<span className={cn("flex-1 text-sm truncate", isSelected && "font-medium")}>
								{item.name}
							</span>

							{isSelected && <Check className="size-4 ml-auto shrink-0" style={{ color }} />}
						</div>
					);
				}}
				itemClassName={(item) =>
					item.id === MANAGE_AGENT_ID ? "sticky bottom-0 z-10 border-t border-border bg-card" : ""
				}
				triggerStyle={{
					boxShadow: `0 0 0 1px ${accentColor}30`,
				}}
				triggerClassName={cn("gap-1 min-w-[140px]", triggerClassName)}
				contentClassName="min-w-[180px]"
			/>
			<AgentManagerDrawer />
		</>
	);
}

export { AgentChip };
export type { AgentChipProps };
