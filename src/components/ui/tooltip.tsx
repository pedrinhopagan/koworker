import { type ReactNode, useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type TooltipProps = {
	label: ReactNode;
	children: ReactNode;
	side?: "top" | "right" | "bottom" | "left";
	align?: "start" | "center" | "end";
	className?: string;
};

export function Tooltip({
	label,
	children,
	side = "top",
	align = "center",
	className,
}: TooltipProps) {
	const [open, setOpen] = useState(false);
	const trigger = <span className="inline-flex">{children}</span>;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				asChild
				onMouseEnter={() => setOpen(true)}
				onMouseLeave={() => setOpen(false)}
				onFocus={() => setOpen(true)}
				onBlur={() => setOpen(false)}
			>
				{trigger}
			</PopoverTrigger>
			<PopoverContent
				side={side}
				align={align}
				className={cn(
					"px-2 py-1 text-xs text-foreground bg-background border border-border",
					className,
				)}
			>
				{label}
			</PopoverContent>
		</Popover>
	);
}
