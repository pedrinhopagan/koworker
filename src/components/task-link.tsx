import { Link } from "@tanstack/react-router";
import { ListTree } from "lucide-react";

import { cn } from "@/lib/utils";

export function TaskLink({
	taskId,
	label = "Abrir tarefa",
	compact = false,
	className,
}: {
	taskId: string;
	label?: string;
	compact?: boolean;
	className?: string;
}) {
	return (
		<Link
			to="/tarefas/$taskId"
			params={{ taskId }}
			aria-label={compact ? label : undefined}
			title={compact ? label : undefined}
			className={cn(
				"inline-flex shrink-0 items-center justify-center gap-1.5 border border-border bg-muted/40 text-xs font-semibold text-foreground transition-colors hover:border-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
				compact ? "min-h-9 w-9" : "min-h-9 px-2.5",
				className,
			)}
		>
			<ListTree className="size-3.5 shrink-0 text-primary" />
			{!compact && <span className="max-w-40 truncate">{label}</span>}
		</Link>
	);
}
