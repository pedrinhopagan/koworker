import { Search } from "lucide-react";

import type { HistoryCli } from "@/api/helpers/agent-history/paths";
import { Input } from "@/components/ui/input";
import { CustomSelect } from "@/components/ui/custom-select";
import { agentRadarAgentLabel } from "@/constants/agent-radar";

const ALL = "todos";

const CLI_ITEMS = [
	{ id: ALL, label: "Claude e Codex" },
	{ id: "claude", label: agentRadarAgentLabel("claude") },
	{ id: "codex", label: agentRadarAgentLabel("codex") },
];

export type HistoryFiltersValue = {
	projectId: string | null;
	cli: HistoryCli | null;
	search: string;
};

export function HistoryFilters({
	value,
	projects,
	projectsLoading,
	onChange,
}: {
	value: HistoryFiltersValue;
	projects: { id: string; name: string }[];
	projectsLoading: boolean;
	onChange: (next: Partial<HistoryFiltersValue>) => void;
}) {
	const projectItems = [{ id: ALL, name: "Todos os projetos" }, ...projects];

	return (
		<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
			<div className="relative flex-1">
				<Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
				<Input
					value={value.search}
					onChange={(event) => onChange({ search: event.target.value })}
					placeholder="Buscar por assunto, pasta ou branch"
					className="pl-8"
				/>
			</div>

			<CustomSelect
				items={projectItems}
				value={value.projectId ?? ALL}
				loading={projectsLoading}
				className="sm:w-56"
				onValueChange={(next) => onChange({ projectId: next === ALL ? null : next })}
				renderItem={(project) => <span className="truncate">{project.name}</span>}
			/>

			<CustomSelect
				items={CLI_ITEMS}
				value={value.cli ?? ALL}
				className="sm:w-44"
				onValueChange={(next) => onChange({ cli: next === ALL ? null : (next as HistoryCli) })}
				renderItem={(item) => <span className="truncate">{item.label}</span>}
			/>
		</div>
	);
}
