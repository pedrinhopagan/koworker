import { Slot } from "@radix-ui/react-slot";
import type * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";

import { cn } from "@/lib/utils";

const buttonVariants = tv({
	base: "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[var(--control-radius)] border text-sm font-medium outline-none transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:not-[aria-haspopup]:scale-[0.97] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
	variants: {
		variant: {
			default:
				"border-primary bg-primary text-primary-foreground shadow-xs inset-shadow-[0_1px_rgb(255_255_255/16%)] hover:bg-primary/90 active:shadow-none",
			destructive:
				"border-destructive bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive",
			outline:
				"border-input bg-popover text-foreground shadow-xs hover:bg-accent/50 dark:bg-input/30 dark:inset-shadow-[0_1px_rgb(255_255_255/6%)] dark:hover:bg-input/60",
			secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
			ghost:
				"border-transparent hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent",
			"ghost-muted":
				"border-transparent text-muted-foreground hover:bg-accent hover:text-foreground data-[state=open]:bg-accent",
			link: "border-transparent text-primary underline-offset-4 hover:underline",
		},
		size: {
			default: "h-11 px-3 sm:h-8",
			sm: "h-11 gap-1.5 px-2.5 sm:h-7",
			lg: "h-11 px-4 sm:h-9",
			compact: "h-7 gap-1 rounded-md px-2 text-xs",
			icon: "size-11 sm:size-8",
			"icon-sm": "size-11 sm:size-7",
			"icon-lg": "size-11 sm:size-9",
			"icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3.5",
		},
	},
	defaultVariants: {
		variant: "default",
		size: "default",
	},
});

export interface ButtonProps
	extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

function Button({
	className,
	variant = "default",
	size = "default",
	asChild = false,
	...props
}: ButtonProps) {
	const Comp = asChild ? Slot : "button";

	return (
		<Comp
			data-slot="button"
			data-variant={variant}
			data-size={size}
			type={asChild ? undefined : "button"}
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
