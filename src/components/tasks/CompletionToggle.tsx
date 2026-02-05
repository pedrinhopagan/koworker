import type * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const completionToggleVariants = tv({
	base: "shrink-0 transition-colors",
	variants: {
		size: {
			default: "",
			sm: "",
			lg: "",
		},
	},
	defaultVariants: {
		size: "default",
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
	function handleCheckedChange(value: boolean | "indeterminate") {
		if (value !== "indeterminate") {
			onCheckedChange(value);
		}
	}

	function handleClick(e: React.MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
	}

	return (
		<Checkbox
			checked={checked}
			onCheckedChange={handleCheckedChange}
			onClick={handleClick}
			disabled={disabled}
			size={size === "sm" ? "sm" : size === "lg" ? "lg" : "default"}
			className={cn(completionToggleVariants({ size }), className)}
			aria-label={ariaLabel}
		/>
	);
}
