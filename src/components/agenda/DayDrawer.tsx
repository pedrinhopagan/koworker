import { X } from "lucide-react";
import { useCallback, useEffect } from "react";

import { Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAgendaStore } from "@/stores/agenda";
import { DayTaskItem } from "./DayTaskItem";
import { useDayTasks } from "./use-day-tasks";

type DayDrawerProps = {
	onTaskChange?: () => void;
};

export function DayDrawer({ onTaskChange }: DayDrawerProps) {
	const selectedDate = useAgendaStore((s) => s.selectedDate);
	const drawerCollapsed = useAgendaStore((s) => s.drawerCollapsed);
	const closeDrawer = useAgendaStore((s) => s.closeDrawer);

	const { tasks, loading, refetch } = useDayTasks(selectedDate);

	const formattedDate = useCallback(() => {
		if (!selectedDate) return "";
		const date = new Date(`${selectedDate}T00:00:00`);
		return date.toLocaleDateString("pt-BR", {
			weekday: "long",
			day: "numeric",
			month: "long",
			year: "numeric",
		});
	}, [selectedDate]);

	function handleTaskChange() {
		refetch();
		onTaskChange?.();
	}

	// Close on Escape key
	useEffect(() => {
		function handleKeydown(e: KeyboardEvent) {
			if (e.key === "Escape") {
				closeDrawer();
			}
		}
		window.addEventListener("keydown", handleKeydown);
		return () => window.removeEventListener("keydown", handleKeydown);
	}, [closeDrawer]);

	if (!selectedDate || drawerCollapsed) return null;

	return (
		<>
			{/* Backdrop */}
			<button
				type="button"
				className="animate-fade-in fixed inset-0 z-40 bg-black/50"
				onClick={closeDrawer}
				aria-label="Fechar drawer"
			/>

			{/* Drawer */}
			<div
				className={cn(
					"animate-slide-in-right fixed top-0 right-0 z-50 flex h-full w-[400px] flex-col border-l border-border bg-background shadow-xl",
				)}
			>
				{/* Header */}
				<div className="flex items-center justify-between border-b border-border p-4">
					<div className="flex items-center gap-3">
						<Button variant="ghost" size="icon" onClick={closeDrawer} className="h-8 w-8">
							<X className="h-4 w-4" />
						</Button>
						<Title as="h2" size="md" className="font-medium capitalize">
							{formattedDate()}
						</Title>
					</div>
					<span className="text-sm text-muted-foreground">
						{tasks.length} {tasks.length === 1 ? "tarefa" : "tarefas"}
					</span>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto">
					{loading ? (
						<div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
					) : tasks.length === 0 ? (
						<div className="py-8 text-center text-sm text-muted-foreground">
							Nenhuma tarefa para este dia
						</div>
					) : (
						<div className="flex flex-col">
							{tasks.map((task) => (
								<DayTaskItem
									key={task.id}
									task={task}
									scheduledDate={selectedDate}
									onStatusChange={handleTaskChange}
								/>
							))}
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="border-t border-border p-3 text-xs text-muted-foreground">
					Arraste tarefas para reagendar
				</div>
			</div>
		</>
	);
}
