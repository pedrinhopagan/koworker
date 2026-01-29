import type { ReactNode } from "react";

import { Text, Title } from "@/components/typography";

type PageShellProps = {
	title: string;
	description?: string;
	actions?: ReactNode;
	children: ReactNode;
};

export function PageShell({ title, description, actions, children }: PageShellProps) {
	return (
		<div className="mx-auto w-full max-w-6xl px-6 py-6">
			<div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
				<div className="space-y-1">
					<Title size="md">{title}</Title>
					{description && (
						<Text size="sm" tone="muted">
							{description}
						</Text>
					)}
				</div>
				{actions && <div className="flex items-center gap-2">{actions}</div>}
			</div>
			{children}
		</div>
	);
}
