import type * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";

import { cn } from "@/lib/utils";

const completionToggleVariants = tv({
	base: "shrink-0 cursor-pointer font-mono leading-none transition-colors text-muted-foreground hover:text-primary disabled:cursor-not-allowed disabled:opacity-50",
	variants: {
		size: {
			default: "text-sm",
			sm: "text-xs",
			lg: "text-base",
		},
		checked: {
			true: "text-primary",
			false: "",
		},
	},
	defaultVariants: {
		size: "default",
		checked: false,
	},
});

type CompletionToggleProps = {
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	disabled?: boolean;
	size?: VariantProps<typeof completionToggleVariants>["size"];
	className?: string;
	"aria-label"?: string;
};

export function CompletionToggle({
	checked,
	onCheckedChange,
	disabled = false,
	size = "default",
	className,
	"aria-label": ariaLabel,
}: CompletionToggleProps) {
	function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
		e.preventDefault();
		e.stopPropagation();
		if (!disabled) {
			onCheckedChange(!checked);
		}
	}

	return (
		<button
			type="button"
			onClick={handleClick}
			disabled={disabled}
			className={cn(completionToggleVariants({ size, checked }), className)}
			aria-label={ariaLabel}
			aria-pressed={checked}
		>
			{checked ? "[x]" : "[ ]"}
		</button>
	);
}
