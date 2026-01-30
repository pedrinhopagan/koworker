import { memo } from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "@/lib/utils";

const progressCircleVariants = tv({
	base: "relative inline-flex flex-col items-center",
	variants: {
		size: {
			sm: "",
			md: "",
			lg: "",
		},
	},
	defaultVariants: {
		size: "md",
	},
});

const sizeConfig = {
	sm: { size: 48, strokeWidth: 4, textClass: "text-xs" },
	md: { size: 80, strokeWidth: 6, textClass: "text-lg" },
	lg: { size: 120, strokeWidth: 8, textClass: "text-2xl" },
} as const;

export type ProgressCircleProps = VariantProps<typeof progressCircleVariants> & {
	/** Progress value from 0 to 100 */
	progress: number;
	/** Show percentage label inside circle (default: true) */
	showLabel?: boolean;
	/** Secondary label below percentage (e.g., "3/7 subtarefas") */
	label?: string;
	/** Additional CSS class */
	className?: string;
};

export const ProgressCircle = memo(function ProgressCircle({
	progress,
	size: sizeVariant = "md",
	showLabel = true,
	label,
	className,
}: ProgressCircleProps) {
	const config = sizeConfig[sizeVariant ?? "md"];
	const { size, strokeWidth, textClass } = config;

	const clampedProgress = Math.min(100, Math.max(0, progress));
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const strokeDashoffset = circumference - (clampedProgress / 100) * circumference;
	const center = size / 2;

	return (
		<div
			className={cn(progressCircleVariants({ size: sizeVariant }), className)}
			style={{ width: size, height: showLabel && label ? size + 20 : size }}
		>
			<svg
				width={size}
				height={size}
				viewBox={`0 0 ${size} ${size}`}
				className="transform -rotate-90"
				role="img"
				aria-labelledby="progress-circle-title"
			>
				<title id="progress-circle-title">Progresso: {Math.round(clampedProgress)}%</title>
				{/* Background circle */}
				<circle
					cx={center}
					cy={center}
					r={radius}
					fill="none"
					stroke="currentColor"
					strokeWidth={strokeWidth}
					className="text-secondary"
				/>
				{/* Progress circle */}
				<circle
					cx={center}
					cy={center}
					r={radius}
					fill="none"
					stroke="currentColor"
					strokeWidth={strokeWidth}
					strokeLinecap="square"
					strokeDasharray={circumference}
					strokeDashoffset={strokeDashoffset}
					className="text-primary transition-[stroke-dashoffset] duration-700 ease-out"
				/>
			</svg>

			{showLabel && (
				<div
					className="absolute inset-0 flex flex-col items-center justify-center"
					style={{ width: size, height: size }}
				>
					<span className={cn("font-semibold text-foreground leading-none", textClass)}>
						{Math.round(clampedProgress)}%
					</span>
				</div>
			)}

			{label && (
				<span className="text-xs text-muted-foreground mt-1 whitespace-nowrap">{label}</span>
			)}
		</div>
	);
});

export { progressCircleVariants };
