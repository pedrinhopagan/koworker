import { Check, ChevronDown } from "lucide-react";

import type { RouterOutputs } from "@/client";
import { Text } from "@/components/typography";
import { Checkbox } from "@/components/ui/checkbox";
import { CustomSelect } from "@/components/ui/custom-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	COMPLEXITY_COLORS,
	COMPLEXITY_LABELS,
	TASK_COMPLEXITIES,
	type TaskComplexity,
} from "@/constants/complexity";
import { cn } from "@/lib/utils";

type DiscoveredTask = RouterOutputs["tasks"]["discoverSync"][number];
type Category = RouterOutputs["categories"]["list"][number];
type Priority = RouterOutputs["priorities"]["list"][number];

export interface TaskSyncDraft extends DiscoveredTask {
	selected: boolean;
	categoryId?: string;
	priorityId?: string;
	complexity: TaskComplexity;
	done: boolean;
}

const complexityItems = TASK_COMPLEXITIES.map((complexity) => ({
	id: complexity,
	name: COMPLEXITY_LABELS[complexity],
	color: COMPLEXITY_COLORS[complexity],
}));

function ColoredSelect({
	label,
	items,
	value,
	disabled,
	onValueChange,
}: {
	label: string;
	items: { id: string; name: string; color: string }[];
	value?: string;
	disabled: boolean;
	onValueChange: (value: string) => void;
}) {
	const selected = items.find((item) => item.id === value);

	return (
		<CustomSelect
			items={items}
			value={value ?? ""}
			onValueChange={onValueChange}
			disabled={disabled}
			label={label}
			upperLabel
			triggerClassName="w-full"
			renderTrigger={() => (
				<>
					<span className="flex min-w-0 items-center gap-2">
						<span
							className="size-2 shrink-0 rounded-full"
							style={{ backgroundColor: selected?.color ?? "#6b7280" }}
						/>
						<span className="truncate">{selected?.name ?? label}</span>
					</span>
					<ChevronDown className="size-4 text-muted-foreground" />
				</>
			)}
			renderItem={(item, isSelected) => (
				<div className={cn("flex items-center gap-2", isSelected && "font-medium")}>
					<span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
					<span className="flex-1 truncate">{item.name}</span>
					{isSelected && <Check className="size-4" />}
				</div>
			)}
		/>
	);
}

export function TaskSyncRow({
	draft,
	categories,
	priorities,
	disabled,
	onChange,
}: {
	draft: TaskSyncDraft;
	categories: Category[];
	priorities: Priority[];
	disabled: boolean;
	onChange: (updates: Partial<TaskSyncDraft>) => void;
}) {
	return (
		<div
			className={cn(
				"border border-border bg-card p-4 transition-opacity",
				!draft.selected && "opacity-55",
			)}
		>
			<div className="flex items-start gap-3">
				<Checkbox
					checked={draft.selected}
					disabled={disabled}
					onCheckedChange={(checked) => onChange({ selected: checked === true })}
					aria-label={`Incluir ${draft.title}`}
					className="mt-2.5"
				/>
				<div className="min-w-0 flex-1">
					<Input
						value={draft.title}
						disabled={disabled || !draft.selected}
						onChange={(event) => onChange({ title: event.target.value })}
						aria-label="Título da tarefa"
						className="font-medium"
					/>
					<Text size="xs" tone="muted" className="mt-1 truncate">
						{draft.projectName} · {draft.folderPath} · {draft.fileCount} arquivo
						{draft.fileCount === 1 ? "" : "s"}
					</Text>
				</div>
			</div>

			<div className="mt-4 grid gap-3 pl-7 sm:grid-cols-3">
				<ColoredSelect
					label="Tipo"
					items={categories}
					value={draft.categoryId}
					disabled={disabled || !draft.selected}
					onValueChange={(categoryId) => onChange({ categoryId })}
				/>
				<ColoredSelect
					label="Prioridade"
					items={priorities}
					value={draft.priorityId}
					disabled={disabled || !draft.selected}
					onValueChange={(priorityId) => onChange({ priorityId })}
				/>
				<ColoredSelect
					label="Complexidade"
					items={complexityItems}
					value={draft.complexity}
					disabled={disabled || !draft.selected}
					onValueChange={(complexity) => onChange({ complexity: complexity as TaskComplexity })}
				/>
			</div>

			<div className="mt-4 flex items-center pl-7">
				<Label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
					<Checkbox
						checked={draft.done}
						disabled={disabled || !draft.selected}
						onCheckedChange={(checked) => onChange({ done: checked === true })}
					/>
					Marcar como já concluída
				</Label>
			</div>
		</div>
	);
}
