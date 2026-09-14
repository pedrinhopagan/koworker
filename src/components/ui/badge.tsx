import type * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";

import { cn } from "@/lib/utils";

const badgeVariants = tv({
	base: "inline-flex items-center rounded-none border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-1 focus:ring-ring",
	variants: {
		variant: {
			default: "border-transparent bg-primary text-primary-foreground",
			secondary: "border-transparent bg-secondary text-secondary-foreground",
			destructive: "border-transparent bg-destructive text-destructive-foreground",
			outline: "text-foreground",
			success: "border-transparent bg-success/15 text-success",
			warning: "border-transparent bg-warning/15 text-warning",
			muted: "border-transparent bg-muted text-muted-foreground",
		},
	},
	defaultVariants: {
		variant: "default",
	},
});

export type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

type BadgeProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
	return (
		<div
			data-slot="badge"
			data-variant={variant}
			className={cn(badgeVariants({ variant }), className)}
			{...props}
		/>
	);
}

export { badgeVariants };
