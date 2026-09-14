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
		>
			{children}
		</Tooltip>
	);
}
