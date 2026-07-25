import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

export function LiveOutput({ text, className }: { text: string; className?: string }) {
	const viewport = useRef<HTMLPreElement>(null);

	useEffect(() => {
		const node = viewport.current;
		if (node) {
			node.scrollTop = node.scrollHeight;
		}
	}, [text]);

	return (
		<pre
			ref={viewport}
			aria-live="polite"
			aria-label="Saída ao vivo do agente"
			className={cn(
				"max-h-40 overflow-y-auto border border-border bg-background/60 p-2 font-mono text-[11px] leading-5 text-muted-foreground whitespace-pre-wrap break-all",
				className,
			)}
		>
			{text}
		</pre>
	);
}
