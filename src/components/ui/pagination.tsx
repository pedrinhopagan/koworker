import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

type PaginationProps = {
	page: number;
	totalPages: number;
	total: number;
	onPageChange: (page: number) => void;
	className?: string;
	singularLabel?: string;
	pluralLabel?: string;
};

function Pagination({
	page,
	totalPages,
	total,
	onPageChange,
	className,
	singularLabel = "tarefa",
	pluralLabel = "tarefas",
}: PaginationProps) {
	if (totalPages <= 1) return null;

	const canGoPrev = page > 1;
	const canGoNext = page < totalPages;

	return (
		<div
			className={cn(
				"flex items-center justify-between gap-4 px-3 py-2 border-t border-border",
				className,
			)}
		>
			<span className="text-xs text-muted-foreground">
				{total} {total === 1 ? singularLabel : pluralLabel}
			</span>

			<div className="flex items-center gap-1">
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={() => onPageChange(page - 1)}
					disabled={!canGoPrev}
				>
					<ChevronLeft size={16} />
				</Button>

				<span className="text-xs text-muted-foreground px-2">
					{page} / {totalPages}
				</span>

				<Button
					variant="ghost"
					size="icon-sm"
					onClick={() => onPageChange(page + 1)}
					disabled={!canGoNext}
				>
					<ChevronRight size={16} />
				</Button>
			</div>
		</div>
	);
}

export { Pagination };
export type { PaginationProps };
