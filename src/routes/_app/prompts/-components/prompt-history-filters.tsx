import { Plus, Search } from "lucide-react";

import type { RouterOutputs } from "@/client";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import { Input } from "@/components/ui/input";
import { PROMPT_HISTORY_KIND_LABEL, type PromptHistoryKind } from "./prompt-history-kind";

type Project = RouterOutputs["projects"]["list"][number];

type PromptHistoryFiltersProps = {
	q: string;
	kind: PromptHistoryKind | undefined;
	projectId: string | undefined;
	projects: Project[];
	onChange: (next: { q?: string; kind?: PromptHistoryKind; projectId?: string }) => void;
	onNew: () => void;
};

const kindItems = [
	{ id: "all", label: "Todos" },
	...Object.entries(PROMPT_HISTORY_KIND_LABEL).map(([id, label]) => ({ id, label })),
];

export function PromptHistoryFilters({
	q,
	kind,
	projectId,
	projects,
	onChange,
	onNew,
}: PromptHistoryFiltersProps) {
	const projectItems = [
		{ id: "all", label: "Todos os projetos" },
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
					placeholder="Buscar por texto, prompt, alvo ou projeto"
					className="h-11 pl-9 text-base md:h-9 md:text-sm"
				/>
			</div>

			<div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,160px)_minmax(0,220px)_auto] sm:items-center">
				<CustomSelect
					items={kindItems}
					value={kind ?? "all"}
					onValueChange={(value) =>
						onChange({ kind: value === "all" ? undefined : (value as PromptHistoryKind) })
					}
					renderItem={(item) => item.label}
					triggerClassName="h-11 w-full text-base md:h-9 md:text-sm"
				/>

				<CustomSelect
					items={projectItems}
					value={projectId ?? "all"}
					onValueChange={(value) => onChange({ projectId: value === "all" ? undefined : value })}
					renderItem={(item) => item.label}
					triggerClassName="h-11 w-full text-base md:h-9 md:text-sm"
				/>

				<Button type="button" onClick={onNew} className="h-11 md:h-9">
					<Plus className="size-4" />
					Novo prompt
				</Button>
			</div>
		</div>
	);
}
