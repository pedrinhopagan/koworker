import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Title } from "@/components/typography";

export function ConversationSidebarHeader({
	icon: Icon,
	title,
	children,
}: {
	icon: LucideIcon;
	title: string;
	children?: ReactNode;
}) {
	return (
		<header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
			<Icon className="size-4 shrink-0 text-primary" />
			<Title as="h2" size="sm" className="min-w-0 flex-1 truncate">
				{title}
			</Title>
			{children}
		</header>
	);
}
