import { Loader2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Text } from "@/components/typography";
import { cn } from "@/lib/utils";

// A linha do rastro é sempre a mesma forma: um quadrado com o ícone do passo e o conteúdo ao lado.
// A cor da borda é o estado, e é o que se lê correndo o olho pela lista.
export function TraceShell({
	icon: Icon,
	tone,
	spinning,
	children,
}: {
	icon: LucideIcon;
	tone?: "error" | "running" | undefined;
	spinning?: boolean;
	children: ReactNode;
}) {
	return (
		<li className="flex min-w-0 gap-3 py-1.5">
			<span
				className={cn(
					"mt-0.5 flex size-6 shrink-0 items-center justify-center border border-border bg-background text-muted-foreground",
					tone === "error" && "border-destructive text-destructive",
					tone === "running" && "border-primary text-primary",
				)}
			>
				{spinning ? <Loader2 className="size-3 animate-spin" /> : <Icon className="size-3" />}
			</span>
			<div className="min-w-0 flex-1">{children}</div>
		</li>
	);
}

export function TraceLabel({
	children,
	tone,
}: {
	children: ReactNode;
	tone?: "error" | undefined;
}) {
	return (
		<Text
			as="span"
			className={cn(
				"text-[11px] font-bold uppercase tracking-[0.1em]",
				tone === "error" && "text-destructive",
			)}
		>
			{children}
		</Text>
	);
}

export function toneOf(status: "running" | "ok" | "error") {
	if (status === "error") {
		return "error" as const;
	}

	return status === "running" ? ("running" as const) : undefined;
}
