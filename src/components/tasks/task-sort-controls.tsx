import { ArrowDownAZ, Clock, Flame, Gauge, LayoutGrid } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { TASK_SORT_MODES, type TaskSortMode } from "@/constants/tasks";
import { cn } from "@/lib/utils";

const icons = {
	recente: Clock,
	categoria: LayoutGrid,
	prioridade: Flame,
	complexidade: Gauge,
	alfabetica: ArrowDownAZ,
};

export const TASK_SORT_OPTIONS = TASK_SORT_MODES.map((option) => ({
	mode: option.mode,
	label: option.label,
	icon: icons[option.mode],
}));

export function TaskSortControls({
	value,
	onChange,
	className,
}: {
	value: TaskSortMode;
	onChange: (mode: TaskSortMode) => void;
	className?: string;
}) {
	return (
		<div className={cn("flex items-center gap-0.5", className)} aria-label="Ordenar tarefas">
			{TASK_SORT_OPTIONS.map(({ mode, label, icon: Icon }) => (
				<Tooltip key={mode} label={`Ordenar por ${label.toLocaleLowerCase("pt-BR")}`}>
					<Button
						type="button"
						variant={value === mode ? "secondary" : "ghost"}
						size="icon-sm"
						aria-label={`Ordenar por ${label.toLocaleLowerCase("pt-BR")}`}
						aria-pressed={value === mode}
						className={cn("size-7", value !== mode && "text-muted-foreground")}
						onClick={() => onChange(mode)}
					>
						<Icon className="size-3.5" />
					</Button>
				</Tooltip>
			))}
		</div>
	);
}
