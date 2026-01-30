import type { LucideIcon } from "lucide-react";
import { tv, type VariantProps } from "tailwind-variants";

import { cn } from "@/lib/utils";

const iconVariants = tv({
	base: "inline-flex items-center justify-center",
	variants: {
		size: {
			xs: "size-7",
			sm: "size-8",
			md: "size-9",
			lg: "size-10",
		},
		shape: {
			square: "rounded-md",
			rounded: "rounded-lg",
			pill: "rounded-full",
		},
	},
	defaultVariants: {
		size: "sm",
		shape: "square",
	},
});

type IconProps = VariantProps<typeof iconVariants> & {
	icon: LucideIcon;
	color?: string;
	className?: string;
	iconClassName?: string;
};

const iconSizeMap: Record<NonNullable<IconProps["size"]>, number> = {
	xs: 12,
	sm: 14,
	md: 16,
	lg: 18,
};

const withAlpha = (value: string, alpha: string) => {
	if (value.startsWith("#") && value.length === 7) {
		return `${value}${alpha}`;
	}
	return `color-mix(in oklab, ${value} 20%, transparent)`;
};

const withBorder = (value: string, alpha: string) => {
	if (value.startsWith("#") && value.length === 7) {
		return `${value}${alpha}`;
	}
	return `color-mix(in oklab, ${value} 35%, transparent)`;
};

export function Icon({ icon: IconComp, color, size, shape, className, iconClassName }: IconProps) {
	const resolvedColor = color ?? "var(--project-accent, var(--primary))";
	const background = withAlpha(resolvedColor, "1a");
	const border = withBorder(resolvedColor, "33");
	const iconSize = iconSizeMap[size ?? "sm"];

	return (
		<span
			className={cn(iconVariants({ size, shape }), className)}
			style={{ background, boxShadow: `inset 0 0 0 1px ${border}` }}
		>
			<IconComp size={iconSize} className={iconClassName} style={{ color: resolvedColor }} />
		</span>
	);
}

export { iconVariants };
export type { IconProps };
