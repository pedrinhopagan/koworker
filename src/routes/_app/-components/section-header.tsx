import { memo } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";

type SectionHeaderProps = {
	title: string;
	icon: LucideIcon;
	linkTo: string;
	linkLabel: string;
	badge?: string | number;
	accentColor?: string;
};

export const SectionHeader = memo(function SectionHeader({
	title,
	icon: Icon,
	linkTo,
	linkLabel,
	badge,
	accentColor = "hsl(var(--primary))",
}: SectionHeaderProps) {
	return (
		<div className="flex items-center justify-between mb-3">
			<div className="flex items-center gap-2">
				<div
					className="p-1.5 transition-all duration-200"
					style={{
						background: `${accentColor}15`,
					}}
				>
					<Icon size={14} style={{ color: accentColor }} />
				</div>
				<h2 className="text-sm font-medium text-foreground uppercase tracking-wide">{title}</h2>
				{badge !== undefined && (
					<Badge variant="secondary" className="text-xs">
						{badge}
					</Badge>
				)}
			</div>
			<Link
				to={linkTo}
				className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
			>
				{linkLabel}
				<ChevronRight className="size-3" />
			</Link>
		</div>
	);
});
