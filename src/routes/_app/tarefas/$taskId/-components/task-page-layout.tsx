import type { ReactNode } from "react";

type TaskPageLayoutProps = {
	header: ReactNode;
	sidebar: ReactNode;
	content: ReactNode;
};

export function TaskPageLayout({ header, sidebar, content }: TaskPageLayoutProps) {
	return (
		<div className="flex h-full min-h-0 flex-col">
			{header}

			<div className="flex flex-col-reverse gap-6 h-full min-h-0 md:grid md:grid-cols-[2fr_3fr]">
				<aside className="flex flex-col gap-4 lg:sticky lg:top-0 lg:h-fit">{sidebar}</aside>

				<main className="flex-1 min-h-0 overflow-y-auto">{content}</main>
			</div>
		</div>
	);
}
