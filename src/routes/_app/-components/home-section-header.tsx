import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Text, Title } from "@/components/typography";

export function HomeSectionHeader({
	id,
	icon: Icon,
	title,
	count,
	children,
}: {
	id: string;
	icon: LucideIcon;
	title: string;
	count: number;
	children?: ReactNode;
}) {
	return (
		<div className="mb-3 flex items-center justify-between gap-4">
			<div className="flex min-w-0 items-center gap-2">
				<Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
				<Title id={id} as="h2" size="md">
					{title}
				</Title>
				<Text as="span" size="xs" tone="muted" className="font-mono tabular-nums">
					{count}
				</Text>
			</div>
			{children}
		</div>
	);
}
