import type * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";

import { cn } from "@/lib/utils";

const titleVariants = tv({
	base: "font-display text-foreground font-semibold tracking-tight",
	variants: {
		size: {
			xs: "text-xs",
			sm: "text-sm",
			md: "text-base",
			lg: "text-lg",
			xl: "text-xl",
		},
	},
	defaultVariants: {
		size: "lg",
	},
});

const textVariants = tv({
	base: "leading-relaxed",
	variants: {
		size: {
			xs: "text-xs",
			sm: "text-sm",
			md: "text-base",
			lg: "text-lg",
		},
		tone: {
			default: "text-foreground",
			muted: "text-muted-foreground",
			warning: "text-warning",
			success: "text-success",
			destructive: "text-destructive",
		},
	},
	defaultVariants: {
		size: "md",
		tone: "default",
	},
});

type TitleProps = React.HTMLAttributes<HTMLHeadingElement> &
	VariantProps<typeof titleVariants> & {
		as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "div" | "span";
	};

export function Title({ as = "h1", size, className, ...props }: TitleProps) {
	const Comp = as;

	return <Comp className={cn(titleVariants({ size }), className)} {...props} />;
}

type TextProps = React.HTMLAttributes<HTMLParagraphElement> &
	VariantProps<typeof textVariants> & {
		as?: "p" | "span" | "div";
	};

export function Text({ as = "p", size, tone, className, ...props }: TextProps) {
	const Comp = as;

	return <Comp className={cn(textVariants({ size, tone }), className)} {...props} />;
}
