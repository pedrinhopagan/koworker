import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, FileText, Loader2 } from "lucide-react";
import { useState } from "react";

import { orpc } from "@/client";
import { cn } from "@/lib/utils";
import type { TaskFull } from "@/types/tasks";

type TaskHeaderProps = {
	task: NonNullable<TaskFull>;
};

export function TaskHeader({ task }: TaskHeaderProps) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [localTitle, setLocalTitle] = useState(task.title);

	const accentColor = task.project?.color ?? "var(--primary)";

	const updateMutation = useMutation({
		...orpc.tasks.update.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "tasks",
			});
		},
	});

	function handleBack() {
		navigate({ to: "/tarefas" });
	}

	function handleTitleBlur() {
		if (localTitle.trim() && localTitle !== task.title) {
			updateMutation.mutate({ id: task.id, title: localTitle.trim() });
		}
	}

	return (
		<div
			className="relative border-b border-border animate-fade-in"
			style={{
				background: `linear-gradient(135deg, ${accentColor}15 0%, transparent 60%), var(--background)`,
			}}
		>
			<div
				className="absolute left-0 top-0 bottom-0 w-1"
				style={{
					background: `linear-gradient(180deg, ${accentColor} 0%, ${accentColor}60 100%)`,
				}}
			/>

			<div className="flex items-center gap-3 p-3 pl-4">
				<button
					type="button"
					onClick={handleBack}
					className="text-muted-foreground hover:text-foreground transition-all duration-200 p-1.5 hover:bg-secondary/50 active:scale-95"
					title="Voltar"
				>
					<ChevronLeft size={18} />
				</button>

				<div
					className="shrink-0 p-1.5 animate-scale-in"
					style={{
						color: accentColor,
						boxShadow: `0 0 12px ${accentColor}30`,
					}}
				>
					<FileText size={18} />
				</div>

				<input
					type="text"
					value={localTitle}
					onChange={(e) => setLocalTitle(e.target.value)}
					onBlur={handleTitleBlur}
					disabled={updateMutation.isPending}
					className={cn(
						"flex-1 bg-transparent text-foreground text-base font-medium",
						"focus:outline-none border-b border-transparent focus:border-primary transition-colors",
						"disabled:opacity-50",
					)}
				/>

				{updateMutation.isPending && (
					<Loader2 size={14} className="animate-spin text-muted-foreground" />
				)}
			</div>
		</div>
	);
}
