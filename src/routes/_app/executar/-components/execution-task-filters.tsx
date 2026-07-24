import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";

import type { RouterOutputs } from "@/client";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import { Switch } from "@/components/ui/switch";
import {
	COMPLEXITY_COLORS,
	COMPLEXITY_LABELS,
	TASK_COMPLEXITIES,
	type TaskComplexity,
} from "@/constants/complexity";

type Category = RouterOutputs["categories"]["list"][number];
type Priority = RouterOutputs["priorities"]["list"][number];

export type ExecutionTaskFilterValue = {
	categoryId?: string;
	priorityId?: string;
	complexity?: TaskComplexity;
	includeCompleted?: boolean;
};

const ALL = "__all__";

function FilterSelect({
	items,
	value,
	placeholder,
	onChange,
}: {
	items: { id: string; name: string; color: string }[];
	value?: string;
	placeholder: string;
	onChange: (value: string | undefined) => void;
}) {
	const selected = items.find((item) => item.id === value);

	return (
		<CustomSelect
			items={[{ id: ALL, name: placeholder, color: "#6b7280" }, ...items]}
			value={value ?? ALL}
			onValueChange={(next) => onChange(next === ALL ? undefined : next)}
			renderTrigger={() => (
				<>
					<span className="flex min-w-0 items-center gap-2">
						<span
							className="size-2 shrink-0"
							style={{ backgroundColor: selected?.color ?? "#6b7280" }}
						/>
						<span className="truncate">{selected?.name ?? placeholder}</span>
					</span>
					<ChevronDown className="size-4 text-muted-foreground" />
				</>
			)}
			renderItem={(item) => (
				<span className="flex items-center gap-2">
					<span className="size-2 shrink-0" style={{ backgroundColor: item.color }} />
					<span className="truncate">{item.name}</span>
				</span>
			)}
			label={placeholder}
			triggerClassName="w-full bg-background"
		/>
	);
}

export function ExecutionTaskFilters({
	value,
	categories,
	priorities,
	onChange,
}: {
	value: ExecutionTaskFilterValue;
	categories: Category[];
	priorities: Priority[];
	onChange: (value: ExecutionTaskFilterValue) => void;
}) {
	const [open, setOpen] = useState(false);
	const activeFilters = [
		value.categoryId,
		value.priorityId,
		value.complexity,
		value.includeCompleted,
	].filter(Boolean).length;
	const complexityItems = useMemo(
		() =>
			TASK_COMPLEXITIES.map((complexity) => ({
				id: complexity,
				name: COMPLEXITY_LABELS[complexity],
				color: COMPLEXITY_COLORS[complexity],
			})),
		[],
	);

	return (
		<div className="border-b border-border pb-3">
			<div className="flex items-center justify-between gap-3">
				<Button
					type="button"
					variant={activeFilters > 0 ? "secondary" : "ghost"}
					size="sm"
					onClick={() => setOpen((current) => !current)}
				>
					<SlidersHorizontal className="size-4" />
					Filtros
					{activeFilters > 0 && (
						<span className="flex size-4 items-center justify-center bg-primary text-[10px] text-primary-foreground">
							{activeFilters}
						</span>
					)}
				</Button>
				{activeFilters > 0 && (
					<Button type="button" variant="ghost" size="sm" onClick={() => onChange({})}>
						<X className="size-4" />
						Limpar
					</Button>
				)}
			</div>

			{open && (
				<div className="mt-3 grid gap-3 border border-border bg-muted/20 p-3 sm:grid-cols-3">
					<FilterSelect
						items={categories}
						value={value.categoryId}
						placeholder="Todos os tipos"
						onChange={(categoryId) => onChange({ ...value, categoryId })}
					/>
					<FilterSelect
						items={priorities}
						value={value.priorityId}
						placeholder="Todas as prioridades"
						onChange={(priorityId) => onChange({ ...value, priorityId })}
					/>
					<FilterSelect
						items={complexityItems}
						value={value.complexity}
						placeholder="Todas as complexidades"
						onChange={(complexity) =>
							onChange({ ...value, complexity: complexity as TaskComplexity | undefined })
						}
					/>
					<label className="flex cursor-pointer items-center justify-between gap-3 border-t border-border pt-3 sm:col-span-3">
						<span>
							<Text className="font-semibold">Incluir concluídas</Text>
							<Text size="xs" tone="muted">
								Desativado por padrão para destacar o trabalho pendente.
							</Text>
						</span>
						<Switch
							checked={!!value.includeCompleted}
							onCheckedChange={(includeCompleted) =>
								onChange({ ...value, includeCompleted: includeCompleted || undefined })
							}
						/>
					</label>
				</div>
			)}
		</div>
	);
}
