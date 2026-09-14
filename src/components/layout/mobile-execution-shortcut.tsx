import { Link, useRouterState } from "@tanstack/react-router";
import { SquareTerminal } from "lucide-react";

import { Text } from "@/components/typography";

export function MobileExecutionShortcut() {
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	if (pathname.startsWith("/shells")) {
		return null;
	}

	return (
		<Link
			to="/shells"
			className="flex min-h-12 min-w-0 flex-1 items-center gap-3 border border-border/80 bg-card px-3 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
		>
			<SquareTerminal className="size-4 shrink-0 text-muted-foreground" />
			<span className="min-w-0 flex-1">
				<Text as="span" className="block font-bold">
					Shells
				</Text>
				<Text as="span" className="block truncate text-[11px] text-muted-foreground">
					Terminais e conversas de agents
				</Text>
			</span>
		</Link>
	);
}
