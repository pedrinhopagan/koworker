import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal, X } from "lucide-react";

import { orpc } from "@/client";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { VaultGroup } from "./vault-grouped-view";

// Estado dos filtros do vault (grill #3). Predicados sobre a lista plana, aplicados antes do
// agrupamento. Origem é exclusiva (segmentado); categoria/prioridade são id ou null (sem filtro);
// `includeCompleted` revela as tarefas concluídas (ocultas por padrão).
export type VaultFilterState = {
	origin: "all" | "loose" | "task";
	includeCompleted: boolean;
	categoryId: string | null;
	priorityId: string | null;
};

export const EMPTY_VAULT_FILTERS: VaultFilterState = {
	origin: "all",
	includeCompleted: false,
	categoryId: null,
	priorityId: null,
};

// Quantos filtros estão fora do padrão — vira o badge e governa o botão de limpar.
export function activeFilterCount(filters: VaultFilterState): number {
	let count = 0;
	if (filters.origin !== "all") count++;
	if (filters.includeCompleted) count++;
	if (filters.categoryId) count++;
	if (filters.priorityId) count++;
	return count;
}

function Segmented<T extends string>({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: T;
	options: { value: T; label: string }[];
	onChange: (value: T) => void;
}) {
	return (
		<div className="flex items-center gap-2">
			<Text size="xs" tone="muted" className="w-16 shrink-0">
				{label}
			</Text>
			<div className="flex gap-1">
				{options.map((option) => (
					<button
						key={option.value}
						type="button"
						onClick={() => onChange(option.value)}
						className={cn(
							"border px-2 py-0.5 text-xs transition-colors",
							value === option.value
								? "border-foreground bg-foreground text-background"
								: "border-border text-muted-foreground hover:text-foreground",
						)}
					>
						{option.label}
					</button>
				))}
			</div>
		</div>
	);
}

function ColorPicker({
	label,
	items,
	value,
	onChange,
}: {
	label: string;
	items: { id: string; name: string; color: string }[];
	value: string | null;
	onChange: (id: string | null) => void;
}) {
	return (
		<div className="flex items-start gap-2">
			<Text size="xs" tone="muted" className="mt-1 w-16 shrink-0">
				{label}
			</Text>
			<div className="flex flex-wrap gap-1">
				{items.map((item) => {
					const selected = value === item.id;
					return (
						<button
							key={item.id}
							type="button"
							onClick={() => onChange(selected ? null : item.id)}
							className={cn(
								"flex items-center gap-1 border px-2 py-0.5 text-xs transition-colors",
								selected
									? "border-foreground text-foreground"
									: "border-border text-muted-foreground hover:text-foreground",
							)}
						>
							<span className="size-1.5 rounded-full" style={{ backgroundColor: item.color }} />
							{item.name}
						</button>
					);
				})}
			</div>
		</div>
	);
}

// Barra de filtros do vault. Apresentacional: recebe o estado, devolve o próximo. As opções de
// categoria/prioridade vêm das listas.
export function VaultFilters({
	filters,
	onChange,
}: {
	filters: VaultFilterState;
	onChange: (next: VaultFilterState) => void;
}) {
	const categoriesQuery = useQuery(orpc.categories.list.queryOptions());
	const prioritiesQuery = useQuery(orpc.priorities.list.queryOptions());
	const categories = categoriesQuery.data ?? [];
	const priorities = prioritiesQuery.data ?? [];

	const active = activeFilterCount(filters);

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant={active > 0 ? "secondary" : "ghost"}
					size="sm"
					className="relative"
				>
					<SlidersHorizontal className="size-4" />
					Filtros
					{active > 0 && (
						<span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
							{active}
						</span>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-80 space-y-3 p-3">
				<div className="flex items-center justify-between">
					<Text size="sm" className="font-medium">
						Filtros
					</Text>
					{active > 0 && (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-6 px-2 text-muted-foreground"
							onClick={() => onChange(EMPTY_VAULT_FILTERS)}
						>
							<X className="size-3.5" />
							Limpar
						</Button>
					)}
				</div>

				<Segmented
					label="Origem"
					value={filters.origin}
					options={[
						{ value: "all", label: "Tudo" },
						{ value: "loose", label: "Soltas" },
						{ value: "task", label: "Em tarefas" },
					]}
					onChange={(origin) => onChange({ ...filters, origin })}
				/>

				{categories.length > 0 && (
					<ColorPicker
						label="Categoria"
						items={categories}
						value={filters.categoryId}
						onChange={(categoryId) => onChange({ ...filters, categoryId })}
					/>
				)}

				{priorities.length > 0 && (
					<ColorPicker
						label="Prioridade"
						items={priorities}
						value={filters.priorityId}
						onChange={(priorityId) => onChange({ ...filters, priorityId })}
					/>
				)}

				<label className="flex cursor-pointer items-center justify-between gap-2">
					<Text size="xs" tone="muted">
						Ver tarefas concluídas
					</Text>
					<Switch
						checked={filters.includeCompleted}
						onCheckedChange={(checked) => onChange({ ...filters, includeCompleted: checked })}
						size="default"
					/>
				</label>
			</PopoverContent>
		</Popover>
	);
}

// Aplica os filtros à lista plana de entries. Group-level (concluída/categoria/prioridade) só se
// aplica a entries de tarefa, resolvidas via o mapa de grupos por chave; notas soltas e arquivos de
// pasta só respondem ao filtro de origem. Devolve as entries que sobrevivem; o agrupamento recompõe
// a partir delas.
export function filterEntries<E extends { origin: string; groupKey: string | null }>(
	entries: E[],
	filters: VaultFilterState,
	taskGroupByKey: Map<string, VaultGroup>,
): E[] {
	return entries.filter((entry) => {
		if (filters.origin === "loose" && entry.origin !== "loose") return false;
		if (filters.origin === "task" && entry.origin !== "task") return false;

		const group =
			entry.origin === "task" && entry.groupKey ? taskGroupByKey.get(entry.groupKey) : null;

		if (!filters.includeCompleted && group?.done) return false;

		// Filtros de tarefa só fazem sentido sobre entries de tarefa; sem grupo, não passam quando o
		// filtro está ativo (a entry não é de uma tarefa que casa).
		if (filters.categoryId && group?.categoryId !== filters.categoryId) return false;
		if (filters.priorityId && group?.priorityId !== filters.priorityId) return false;

		return true;
	});
}
