import { Plus, Search } from "lucide-react";

import type { RouterOutputs } from "@/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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

export function PromptHistoryFilters({
	q,
	kind,
	projectId,
	projects,
	onChange,
	onNew,
}: PromptHistoryFiltersProps) {
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

			<div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,180px)_minmax(0,220px)_auto] md:flex md:items-center">
				<Select
					value={kind ?? "all"}
					onValueChange={(value) =>
						onChange({ kind: value === "all" ? undefined : (value as PromptHistoryKind) })
					}
				>
					<SelectTrigger className="h-11 w-full text-base md:h-9 md:w-[160px] md:text-sm">
						<SelectValue placeholder="Tipo" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">Todos</SelectItem>
						{Object.entries(PROMPT_HISTORY_KIND_LABEL).map(([value, label]) => (
							<SelectItem key={value} value={value}>
								{label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<Select
					value={projectId ?? "all"}
					onValueChange={(value) => onChange({ projectId: value === "all" ? undefined : value })}
				>
					<SelectTrigger className="h-11 w-full text-base md:h-9 md:w-[220px] md:text-sm">
						<SelectValue placeholder="Projeto" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">Todos os projetos</SelectItem>
						{projects.map((project) => (
							<SelectItem key={project.id} value={project.id}>
								{project.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<Button type="button" onClick={onNew} className="h-11 md:h-9">
					<Plus className="size-4" />
					Novo prompt
				</Button>
			</div>
		</div>
	);
}
