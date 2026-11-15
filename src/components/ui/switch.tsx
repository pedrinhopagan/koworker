import * as SwitchPrimitive from "@radix-ui/react-switch";
import type * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";

import { cn } from "@/lib/utils";

const switchVariants = tv({
	base: "peer inline-flex shrink-0 cursor-pointer select-none items-center border shadow-xs transition-colors duration-150 outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=unchecked]:border-input data-[state=unchecked]:bg-input data-[state=unchecked]:hover:border-muted-foreground/60 dark:data-[state=unchecked]:bg-input/70",
	variants: {
		size: {
			default: "h-5 w-9",
			sm: "h-4 w-7",
			lg: "h-6 w-11",
		},
	},
	defaultVariants: {
		size: "default",
	},
});

const thumbVariants = tv({
	base: "pointer-events-none block shadow-xs ring-0 transition-transform duration-150 ease-out motion-reduce:transition-none data-[state=unchecked]:translate-x-0.5 data-[state=unchecked]:bg-background dark:data-[state=unchecked]:bg-foreground/80 data-[state=checked]:bg-primary-foreground",
	variants: {
		size: {
			default: "size-3.5 data-[state=checked]:translate-x-[18px]",
			sm: "size-2.5 data-[state=checked]:translate-x-[14px]",
			lg: "size-4.5 data-[state=checked]:translate-x-[22px]",
		},
	},
	defaultVariants: {
		size: "default",
	},
});

export interface SwitchProps
	extends React.ComponentProps<typeof SwitchPrimitive.Root>, VariantProps<typeof switchVariants> {}

function Switch({ className, size = "default", ...props }: SwitchProps) {
	return (
		<SwitchPrimitive.Root
			data-slot="switch"
			data-size={size}
			className={cn(switchVariants({ size, className }))}
			{...props}
		>
			<SwitchPrimitive.Thumb data-slot="switch-thumb" className={thumbVariants({ size })} />
		</SwitchPrimitive.Root>
	);
}

export { Switch, switchVariants };
