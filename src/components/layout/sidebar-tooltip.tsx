import type { ReactNode } from "react";

import { Tooltip } from "@/components/ui/tooltip";

type SidebarTooltipProps = {
	label: ReactNode;
	children: ReactNode;
	triggerClassName?: string;
	disabled?: boolean;
	openDelay?: number;
};

export function SidebarTooltip({
	label,
	children,
	triggerClassName,
	disabled,
	openDelay = 150,
}: SidebarTooltipProps) {
	return (
		<Tooltip
			label={label}
			side="right"
			triggerClassName={triggerClassName}
			disabled={disabled}
			openDelay={openDelay}
			className="rounded-md border border-border bg-popover px-2.5 py-1 text-xs font-medium text-popover-foreground shadow-md"
		>
			{children}
		</Tooltip>
	);
}
