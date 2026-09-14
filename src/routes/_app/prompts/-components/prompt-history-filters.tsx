import { Search } from "lucide-react";

import type { PromptSource } from "@/api/schemas/prompt-history";
import type { RouterOutputs } from "@/client";
import { CustomSelect } from "@/components/ui/custom-select";
import { Input } from "@/components/ui/input";
import { PROMPT_SOURCE_LABEL } from "./prompt-source";

type Project = RouterOutputs["projects"]["list"][number];

type PromptHistoryFiltersProps = {
	q: string;
	source: PromptSource | undefined;
	projectId: string | undefined;
	projects: Project[];
	onChange: (next: { q?: string; source?: PromptSource; projectId?: string }) => void;
};

const ALL = "all";

const sourceItems = [
	{ id: ALL, label: "Todas as origens" },
	...Object.entries(PROMPT_SOURCE_LABEL).map(([id, label]) => ({ id, label })),
];

export function PromptHistoryFilters({
	q,
	source,
	projectId,
	projects,
	onChange,
}: PromptHistoryFiltersProps) {
	const projectItems = [
		{ id: ALL, label: "Todos os projetos" },
		...projects.map((project) => ({ id: project.id, label: project.name })),
	];

	return (
		<div className="flex flex-col gap-3 md:flex-row md:items-center">
			<div className="relative min-w-0 flex-1">
				<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					type="search"
					value={q}
					onChange={(event) => onChange({ q: event.target.value || undefined })}
					placeholder="Buscar no texto do prompt, projeto ou pasta"
					className="h-11 pl-9 text-base md:h-9 md:text-sm"
				/>
			</div>

			<div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,180px)_minmax(0,220px)] sm:items-center">
				<CustomSelect
					items={sourceItems}
					value={source ?? ALL}
					onValueChange={(value) =>
						onChange({ source: value === ALL ? undefined : (value as PromptSource) })
					}
					renderItem={(item) => item.label}
					triggerClassName="h-11 w-full text-base md:h-9 md:text-sm"
				/>

				<CustomSelect
					items={projectItems}
					value={projectId ?? ALL}
					onValueChange={(value) => onChange({ projectId: value === ALL ? undefined : value })}
					renderItem={(item) => item.label}
					triggerClassName="h-11 w-full text-base md:h-9 md:text-sm"
				/>
			</div>
		</div>
	);
}
