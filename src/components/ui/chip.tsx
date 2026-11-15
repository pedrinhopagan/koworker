import type * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";

import { cn } from "@/lib/utils";

const chipVariants = tv({
	base: "inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap border font-medium leading-none transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [&_svg]:shrink-0",
	variants: {
		variant: {
			default: "border-border bg-muted text-muted-foreground",
			primary: "border-primary/30 bg-primary/10 text-primary",
			secondary: "border-border bg-secondary text-secondary-foreground",
			destructive: "border-destructive/30 bg-destructive/10 text-destructive",
			success: "border-success/30 bg-success/10 text-success",
			warning: "border-warning/30 bg-warning/10 text-warning",
			accent: "border-accent/30 bg-accent/20 text-accent-foreground",
			outline: "border-border bg-transparent text-foreground",
			ghost: "border-transparent bg-transparent text-muted-foreground",
		},
		size: {
			xs: "h-4 px-1.5 text-[10px] [&_svg]:size-2.5",
			sm: "h-5 px-2 text-xs [&_svg]:size-3",
			md: "h-6 px-2.5 text-sm [&_svg]:size-3.5",
			lg: "h-7 px-3 text-base [&_svg]:size-4",
		},
	},
	defaultVariants: {
		variant: "default",
		size: "sm",
	},
});

export type ChipVariant = NonNullable<VariantProps<typeof chipVariants>["variant"]>;

type ChipProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof chipVariants>;

function Chip({ className, variant, size, ...props }: ChipProps) {
	return (
		<span
			data-slot="chip"
			data-variant={variant}
			data-size={size}
			className={cn(chipVariants({ variant, size }), className)}
			{...props}
		/>
	);
}

export { Chip, chipVariants };
