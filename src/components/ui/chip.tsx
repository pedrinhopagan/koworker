import type * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";

import { cn } from "@/lib/utils";

const chipVariants = tv({
	base: "inline-flex items-center justify-center border transition-colors focus:outline-none focus:ring-1 focus:ring-ring",
	variants: {
		variant: {
			default: "bg-muted text-muted-foreground border-border",
			primary: "bg-primary/10 text-primary border-primary/30",
			secondary: "bg-secondary text-secondary-foreground border-border",
			destructive: "bg-destructive/10 text-destructive border-destructive/30",
			accent: "bg-accent/20 text-accent-foreground border-accent/30",
			outline: "bg-transparent text-foreground border-border",
			ghost: "bg-transparent text-muted-foreground border-transparent",
		},
		size: {
			xs: "text-[10px] py-0.5 px-1.5 h-4",
			sm: "text-xs py-0.5 px-2 h-5",
			md: "text-sm py-1 px-2.5 h-6",
			lg: "text-base py-1.5 px-3 h-7",
		},
		shape: {
			square: "rounded-none",
			rounded: "rounded",
			pill: "rounded-full",
		},
		fill: {
			true: "",
			false: "",
		},
	},
	compoundVariants: [
		// Default variant filled
		{
			variant: "default",
			fill: true,
			class: "bg-muted text-muted-foreground border-muted",
		},
		// Primary variant filled
		{
			variant: "primary",
			fill: true,
			class: "bg-primary text-primary-foreground border-primary",
		},
		// Secondary variant filled
		{
			variant: "secondary",
			fill: true,
			class: "bg-secondary text-secondary-foreground border-secondary",
		},
		// Destructive variant filled
		{
			variant: "destructive",
			fill: true,
			class: "bg-destructive text-destructive-foreground border-destructive",
		},
		// Accent variant filled
		{
			variant: "accent",
			fill: true,
			class: "bg-accent text-accent-foreground border-accent",
		},
		// Outline variant filled
		{
			variant: "outline",
			fill: true,
			class: "bg-foreground text-background border-foreground",
		},
		// Ghost variant filled
		{
			variant: "ghost",
			fill: true,
			class: "bg-primary text-primary-foreground border-primary",
		},
	],
	defaultVariants: {
		variant: "default",
		size: "sm",
		shape: "square",
		fill: false,
	},
});

type ChipProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof chipVariants>;

function Chip({ className, variant, size, shape, fill, ...props }: ChipProps) {
	return (
		<span
			data-slot="chip"
			data-variant={variant}
			data-size={size}
			data-shape={shape}
			className={cn(chipVariants({ variant, size, shape, fill }), className)}
			{...props}
		/>
	);
}

export { Chip, chipVariants };
