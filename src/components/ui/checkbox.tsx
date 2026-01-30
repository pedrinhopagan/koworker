import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon } from "lucide-react";
import type * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";

import { cn } from "@/lib/utils";

const checkboxVariants = tv({
	base: "peer size-4 shrink-0 rounded-none border border-input bg-transparent shadow-xs transition-all duration-200 outline-none hover:border-primary/60 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary data-[state=checked]:scale-110 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:data-[state=checked]:bg-primary",
	variants: {
		size: {
			default: "size-4",
			sm: "size-3.5",
			lg: "size-5",
		},
	},
	defaultVariants: {
		size: "default",
	},
});

const indicatorVariants = tv({
	base: "grid place-content-center text-current animate-scale-in",
	variants: {
		size: {
			default: "[&>svg]:size-3",
			sm: "[&>svg]:size-2.5",
			lg: "[&>svg]:size-3.5",
		},
	},
	defaultVariants: {
		size: "default",
	},
});

export interface CheckboxProps
	extends
		React.ComponentProps<typeof CheckboxPrimitive.Root>,
		VariantProps<typeof checkboxVariants> {}

function Checkbox({ className, size = "default", ...props }: CheckboxProps) {
	return (
		<CheckboxPrimitive.Root
			data-slot="checkbox"
			data-size={size}
			className={cn(checkboxVariants({ size, className }))}
			{...props}
		>
			<CheckboxPrimitive.Indicator
				data-slot="checkbox-indicator"
				className={indicatorVariants({ size })}
			>
				<CheckIcon />
			</CheckboxPrimitive.Indicator>
		</CheckboxPrimitive.Root>
	);
}

export { Checkbox, checkboxVariants };
