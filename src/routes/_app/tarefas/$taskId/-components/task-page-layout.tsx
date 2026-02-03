import type { ReactNode } from "react";
import { PageShell } from "@/components/layout/page-shell";

type TaskPageLayoutProps = {
	header: ReactNode;
	sidebar: ReactNode;
	content: ReactNode;
};

export function TaskPageLayout({ header, sidebar, content }: TaskPageLayoutProps) {
	return (
		<PageShell
			title="Tarefa"
			description="Detalhes da tarefa"
			variant="grid"
			header={<div className="mb-4">{header}</div>}
		>
			<aside className="flex flex-col gap-4 min-h-0 min-w-0 px-4 lg:sticky lg:top-0 lg:h-fit">
				{sidebar}
			</aside>

			<main className="flex-1 min-h-0 min-w-0 overflow-y-auto px-4 pb-4">{content}</main>
		</PageShell>
	);
}
