import type { useDivider } from "@/hooks/use-divider";

export function Divider({
	control,
	side,
	label,
}: {
	control: ReturnType<typeof useDivider>;
	side: "left" | "right";
	label: string;
}) {
	return (
		<div
			role="separator"
			aria-orientation="vertical"
			aria-label={label}
			aria-valuemin={control.valueMin}
			aria-valuemax={Number.isFinite(control.valueMax) ? control.valueMax : undefined}
			aria-valuenow={control.valueNow}
			tabIndex={0}
			data-slot="resize"
			className={`absolute inset-y-0 z-10 w-px cursor-col-resize touch-none transition-colors focus-visible:bg-primary focus-visible:outline-none ${
				side === "left" ? "left-0" : "right-0"
			} ${control.resizing ? "bg-primary" : "bg-border hover:bg-primary/50"}`}
			onKeyDown={control.onKeyDown}
			{...control.pointerProps}
		>
			<span className="absolute inset-y-0 -right-1.5 -left-1.5" />
		</div>
	);
}
