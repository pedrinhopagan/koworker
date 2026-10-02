import { cn } from "@/lib/utils";

type LatticeStatus = "working" | "done" | "error";

const LATTICE_STEP_MS = 100;

const LATTICE_ORDER = [0, 1, 2, 5, 4, 3, 6, 7, 8];

const LATTICE_MARKS: Record<Exclude<LatticeStatus, "working">, number[]> = {
	done: [2, 3, 5, 7],
	error: [0, 2, 4, 6, 8],
};

const LATTICE_LABELS: Record<LatticeStatus, string> = {
	working: "Trabalhando",
	done: "Concluído",
	error: "Falhou",
};

const GRID = "grid grid-cols-3 grid-rows-3 [grid-area:1/1] transition-[opacity,scale] duration-200";

export function LatticeLoader({
	status = "working",
	size = "sm",
	className,
	label,
}: {
	status?: LatticeStatus;
	size?: "sm" | "md";
	className?: string;
	label?: string;
}) {
	const mark = status !== "working" && LATTICE_MARKS[status];
	const gap = size === "sm" ? "gap-px" : "gap-[1.5px]";

	return (
		<span
			role="status"
			aria-label={label ?? LATTICE_LABELS[status]}
			data-status={status}
			className={cn("grid shrink-0", size === "sm" ? "size-3" : "size-4", className)}
		>
			<span aria-hidden className={cn(GRID, gap, !!mark && "opacity-0")}>
				{LATTICE_ORDER.map((order, cell) => (
					<span
						key={cell}
						className={cn("bg-current opacity-20", !mark && "animate-lattice-cell")}
						style={{ animationDelay: `${order * LATTICE_STEP_MS}ms` }}
					/>
				))}
			</span>
			<span
				aria-hidden
				className={cn(
					GRID,
					gap,
					status === "done" && "text-success",
					status === "error" && "text-destructive",
					!mark && "scale-90 opacity-0",
					"motion-reduce:scale-100",
				)}
			>
				{LATTICE_ORDER.map((_order, cell) => (
					<span
						key={cell}
						className={cn("bg-current opacity-20", mark && mark.includes(cell) && "opacity-100")}
					/>
				))}
			</span>
		</span>
	);
}
