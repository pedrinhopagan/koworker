import { CheckCircle2, ChevronDown, Flag, Search, Shapes } from "lucide-react";
import { useMemo, useState } from "react";

import type { RouterOutputs } from "@/client";
import { Text } from "@/components/typography";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { CustomSelect } from "@/components/ui/custom-select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const TASK_TYPE_ALL_ID = "__all_task_type__";
const PRIORITY_ALL_ID = "__all_priority__";

type Category = RouterOutputs["categories"]["list"][number];
type Priority = RouterOutputs["priorities"]["list"][number];

type TaskSearchValue = {
	q?: string;
	taskTypeId?: string;
	priorityId?: string;
	includeCompleted?: boolean;
};

type TaskSearchProps = {
	value: TaskSearchValue;
	categories: Category[];
	priorities: Priority[];
	onChange: (next: TaskSearchValue) => void;
};

export function TaskSearch({ value, categories, priorities, onChange }: TaskSearchProps) {
	const [open, setOpen] = useState(false);

	const taskTypeItems = useMemo(
		() => [
			{ id: TASK_TYPE_ALL_ID, name: "Todos os tipos", color: "#6b7280" },
			...categories.map((category) => ({
				id: category.id,
				name: category.name,
				color: category.color,
			})),
		],
		[categories],
	);

	const priorityItems = useMemo(
		() => [
			{ id: PRIORITY_ALL_ID, name: "Todas as prioridades", color: "#6b7280", level: 0 },
			...priorities.map((priority) => ({
				id: priority.id,
				name: priority.name,
				color: priority.color,
				level: priority.level,
			})),
		],
		[priorities],
	);

	const selectedCategory = categories.find((category) => category.id === value.taskTypeId) ?? null;
	const selectedPriority = priorities.find((priority) => priority.id === value.priorityId) ?? null;

	return (
		<CollapsibleSection
			open={open}
			title={"Pesquisa e filtros"}
			onOpenChange={() => setOpen(!open)}
			variant="compact"
			className="rounded-md border border-dotted bg-muted/20 space-y-3"
		>
			<div className="flex flex-wrap gap-3 px-2 pb-4">
				<div className="flex-1 min-w-60 space-y-1">
					<Text size="xs" tone="muted" className="flex items-center gap-1">
						<Search className="size-3" />
						Buscar
					</Text>
					<Input
						placeholder="Busque por título, descrição ou notas"
						value={value.q ?? ""}
						onChange={(event) => {
							const nextValue = event.target.value;
							const nextQuery = nextValue.trim().length > 0 ? nextValue : undefined;
							onChange({
								...value,
								q: nextQuery,
							});
						}}
					/>
				</div>

				<div className="min-w-48 space-y-1">
					<Text size="xs" tone="muted" className="flex items-center gap-1">
						<Shapes className="size-3" />
						Tipo
					</Text>
					<CustomSelect
						items={taskTypeItems}
						value={value.taskTypeId ?? TASK_TYPE_ALL_ID}
						onValueChange={(newValue) => {
							const nextValue = newValue === TASK_TYPE_ALL_ID ? undefined : newValue;
							onChange({
								...value,
								taskTypeId: nextValue,
							});
						}}
						renderTrigger={() => (
							<>
								<span className="flex items-center gap-2 min-w-0">
									<span
										className="size-2 rounded-full shrink-0"
										style={{ backgroundColor: selectedCategory?.color ?? "#6b7280" }}
									/>
									<span className="truncate">{selectedCategory?.name ?? "Todos os tipos"}</span>
								</span>
								<ChevronDown className="size-4 text-muted-foreground ml-1" />
							</>
						)}
						renderItem={(item, isSelected) => (
							<div
								className={cn(
									"w-full px-3 py-2 flex items-center gap-2",
									isSelected && "font-medium",
								)}
							>
								<span
									className="size-2 rounded-full shrink-0"
									style={{ backgroundColor: item.color ?? "#6b7280" }}
								/>
								<span className="truncate">{item.name}</span>
							</div>
						)}
						label="Tipo da tarefa"
						triggerClassName="min-w-[170px]"
					/>
				</div>

				<div className="min-w-48 space-y-1">
					<Text size="xs" tone="muted" className="flex items-center gap-1">
						<Flag className="size-3" />
						Prioridade
					</Text>
					<CustomSelect
						items={priorityItems}
						value={value.priorityId ?? PRIORITY_ALL_ID}
						onValueChange={(newValue) => {
							const nextValue = newValue === PRIORITY_ALL_ID ? undefined : newValue;
							onChange({
								...value,
								priorityId: nextValue,
							});
						}}
						renderTrigger={() => (
							<>
								<span className="flex items-center gap-2 min-w-0">
									<span
										className="size-2 rounded-full shrink-0"
										style={{ backgroundColor: selectedPriority?.color ?? "#6b7280" }}
									/>
									<span className="truncate">
										{selectedPriority?.name ?? "Todas as prioridades"}
									</span>
								</span>
								<ChevronDown className="size-4 text-muted-foreground ml-1" />
							</>
						)}
						renderItem={(item, isSelected) => (
							<div
								className={cn(
									"w-full px-3 py-2 flex items-center gap-2",
									isSelected && "font-medium",
								)}
							>
								<span
									className="size-2 rounded-full shrink-0"
									style={{ backgroundColor: item.color ?? "#6b7280" }}
								/>
								<span className="truncate">{item.name}</span>
								{typeof item.level === "number" && item.level > 0 && (
									<span className="text-xs text-muted-foreground">{item.level}</span>
								)}
							</div>
						)}
						label="Prioridade"
						triggerClassName="min-w-[190px]"
					/>
				</div>

				<div className="flex flex-col items-center gap-3">
					<Text size="xs" tone="muted" className="flex items-center gap-1">
						<CheckCircle2 className="size-3" />
						Ver concluídas
					</Text>
					<Switch
						checked={Boolean(value.includeCompleted)}
						onCheckedChange={(checked) => {
							onChange({
								...value,
								includeCompleted: checked || undefined,
							});
						}}
						size="default"
					/>
				</div>
			</div>
		</CollapsibleSection>
	);
}
