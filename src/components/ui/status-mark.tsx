import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

export type StatusMarkStatus =
	| "running"
	| "done"
	| "failed"
	| "timeout"
	| "waiting_user"
	| "cancelled";

const STATUS_MARK_LABELS: Record<StatusMarkStatus, string> = {
	running: "Em andamento",
	done: "Concluído",
	failed: "Falhou",
	timeout: "Expirou",
	waiting_user: "Esperando você",
	cancelled: "Interrompido",
};

const STATUS_MARK_TONES: Record<StatusMarkStatus, string> = {
	running: "text-primary",
	done: "text-success",
	failed: "text-destructive",
	timeout: "text-destructive",
	waiting_user: "text-warning",
	cancelled: "text-muted-foreground",
};

const STATUS_MARK_GLYPHS: Record<string, { d: string; on: StatusMarkStatus[] }> = {
	check: { d: "M7.5 12.25 10.5 15.25 16.75 8.75", on: ["done"] },
	cross: { d: "M8.5 8.5 15.5 15.5M15.5 8.5 8.5 15.5", on: ["failed", "cancelled"] },
	clock: { d: "M12 7.5V12l3 2", on: ["timeout"] },
};

const STATUS_MARK_EASE = [0.23, 1, 0.32, 1] as const;

export function StatusMark({
	status,
	className,
	label,
}: {
	status: StatusMarkStatus;
	className?: string;
	label?: string;
}) {
	const reduce = useReducedMotion();
	const running = status === "running";
	const draw = { duration: reduce ? 0 : 0.24, ease: STATUS_MARK_EASE, delay: reduce ? 0 : 0.1 };

	return (
		<svg
			viewBox="0 0 24 24"
			role="img"
			aria-label={label ?? STATUS_MARK_LABELS[status]}
			data-status={status}
			className={cn(
				"size-3.5 shrink-0 overflow-visible transition-colors duration-200",
				STATUS_MARK_TONES[status],
				running && "animate-spin motion-reduce:animate-pulse",
				className,
			)}
		>
			<circle
				cx="12"
				cy="12"
				r="9.5"
				className={cn(
					"fill-current stroke-current transition-[fill-opacity,stroke-opacity] duration-200",
					running
						? "[fill-opacity:0] [stroke-opacity:0.2]"
						: "[fill-opacity:0.1] [stroke-opacity:0]",
				)}
				strokeWidth={2.5}
			/>
			<motion.circle
				cx="12"
				cy="12"
				r="9.5"
				fill="none"
				stroke="currentColor"
				strokeWidth={2.5}
				strokeLinecap="round"
				transform="rotate(-90 12 12)"
				initial={false}
				animate={{
					pathLength: running ? 0.68 : 1,
					opacity: status === "cancelled" ? 0.4 : 1,
				}}
				transition={{ duration: reduce ? 0 : 0.3, ease: STATUS_MARK_EASE }}
			/>
			<motion.circle
				cx="12"
				cy="12"
				r="2.5"
				className="fill-current"
				initial={false}
				animate={{ scale: status === "waiting_user" ? 1 : 0 }}
				transition={draw}
			/>
			{Object.entries(STATUS_MARK_GLYPHS).map(([name, glyph]) => {
				const on = glyph.on.includes(status);

				return (
					<motion.path
						key={name}
						d={glyph.d}
						fill="none"
						stroke="currentColor"
						strokeWidth={2.5}
						strokeLinecap="round"
						strokeLinejoin="round"
						initial={false}
						animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }}
						transition={on ? draw : { duration: reduce ? 0 : 0.12 }}
					/>
				);
			})}
		</svg>
	);
}
