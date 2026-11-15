import type * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				"flex min-h-20 w-full border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs transition-colors duration-150 dark:bg-input/30",
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

export { Textarea };
