import { Target } from "lucide-react";

import { cn } from "@/lib/utils";

type FocusOnScreenIndicatorProps = {
	variant: "workspace" | "item";
	className?: string;
};

export function FocusOnScreenIndicator({ variant, className }: FocusOnScreenIndicatorProps) {
	return (
		<Target
			className={cn(
				"shrink-0 text-primary",
				variant === "workspace" ? "size-3.5" : "size-3",
				className,
			)}
			aria-label="Na tela"
		/>
	);
}
