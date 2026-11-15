import type * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(
				"flex h-8 w-full min-w-0 border border-input bg-background px-3 py-1 text-sm text-foreground shadow-xs transition-colors duration-150 dark:bg-input/30",
				"file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
				"placeholder:text-muted-foreground/70 hover:border-muted-foreground/40",
				"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-ring",
				"disabled:cursor-not-allowed disabled:opacity-50",
				"aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
