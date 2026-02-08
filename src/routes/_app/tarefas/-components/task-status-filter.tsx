import { CheckCircle2, ChevronDown } from "lucide-react";
import { useMemo } from "react";

import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TaskStatusOption = {
	id: string;
	label: string;
};

type TaskStatusFilterProps = {
	value?: string[];
	options: TaskStatusOption[];
	onChange: (nextValue?: string[]) => void;
};

export function TaskStatusFilter({ value, options, onChange }: TaskStatusFilterProps) {
	const optionIds = useMemo(() => options.map((option) => option.id), [options]);

	const selectedIds = useMemo(() => {
		if (optionIds.length === 0) return [];

		const parsed =
			value
				?.filter((statusId) => optionIds.includes(statusId))
				.filter((id, i, arr) => arr.indexOf(id) === i) ?? [];

		if (parsed.length === 0 || parsed.length === optionIds.length) return optionIds;
		return parsed;
	}, [optionIds, value]);

	const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
	const isAllSelected = selectedIds.length === optionIds.length;

	const triggerLabel = useMemo(() => {
		if (isAllSelected || selectedIds.length === 0) return "Todos os status";

		if (selectedIds.length === 1) {
			const selectedOption = options.find((option) => option.id === selectedIds[0]);
			return selectedOption?.label ?? "Status";
		}

		return `${selectedIds.length} status`;
	}, [isAllSelected, options, selectedIds]);

	function handleSelectAll() {
		onChange();
	}

	function handleToggleStatus(statusId: string) {
		const nextSet = new Set(isAllSelected ? optionIds : selectedIds);

		if (nextSet.has(statusId)) {
			nextSet.delete(statusId);
		} else {
			nextSet.add(statusId);
		}

		const nextSelectedIds = optionIds.filter((optionId) => nextSet.has(optionId));

		if (nextSelectedIds.length === 0 || nextSelectedIds.length === optionIds.length) {
			onChange();
			return;
		}

		onChange(nextSelectedIds);
	}

	return (
		<div className="min-w-56 space-y-1">
			<Text size="xs" tone="muted" className="flex items-center gap-1">
				<CheckCircle2 className="size-3" />
				Status
			</Text>

			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-9 w-full justify-between border-input bg-card px-3 text-sm font-normal"
					>
						<span className="truncate text-left">{triggerLabel}</span>
						<ChevronDown className="size-4 text-muted-foreground" />
					</Button>
				</DropdownMenuTrigger>

				<DropdownMenuContent align="start" className="w-[240px]">
					<DropdownMenuLabel>Status da tarefa</DropdownMenuLabel>
					<DropdownMenuItem
						onSelect={(event) => {
							event.preventDefault();
							handleSelectAll();
						}}
					>
						Todos os status
					</DropdownMenuItem>
					<DropdownMenuSeparator />

					{options.map((option) => (
						<DropdownMenuCheckboxItem
							key={option.id}
							checked={selectedSet.has(option.id)}
							onSelect={(event) => {
								event.preventDefault();
								handleToggleStatus(option.id);
							}}
						>
							{option.label}
						</DropdownMenuCheckboxItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
