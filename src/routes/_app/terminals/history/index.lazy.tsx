import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { History, SquareTerminal } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { useCliHistory } from "@/hooks/use-cli-history";
import { HistoryFilters } from "../-components/history-filters";
import { HistoryList } from "../-components/history-list";
import { useHistoryFilters } from "../-utils/use-history-filters";

export const Route = createLazyFileRoute("/_app/terminals/history/")({
	component: TerminalHistoryPage,
});

function TerminalHistoryPage() {
	const search = Route.useSearch();
	const { filters, update, linkSearch, projects, projectsLoading } = useHistoryFilters(search);
	const history = useCliHistory(filters);

	return (
		<PageShell
			title="Histórico de conversas"
			description="Tudo que Claude, Codex e OpenCode 2 já gravaram em disco, em ordem"
			icon={History}
			headerClassName="mb-5"
			contentClassName="flex min-h-0 max-w-none flex-col"
			actions={
				<Button asChild variant="outline" size="sm">
					<Link to="/shells">
						<SquareTerminal className="size-4" />
						Agents abertos
					</Link>
				</Button>
			}
		>
			<div className="mx-auto flex w-full max-w-4xl shrink-0 items-center gap-3 pb-4">
				<HistoryFilters
					value={filters}
					projects={projects}
					projectsLoading={projectsLoading}
					onChange={update}
				/>
				{!history.loading && (
					<Text size="xs" tone="faint" className="hidden shrink-0 tabular-nums sm:block">
						{history.total === 1 ? "1 conversa" : `${history.total} conversas`}
					</Text>
				)}
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="mx-auto w-full max-w-4xl pb-8">
					<HistoryList
						sessions={history.sessions}
						search={linkSearch}
						loading={history.loading}
						hasMore={history.hasMore}
						refreshing={history.refreshing}
						onLoadMore={history.loadMore}
					/>
				</div>
			</div>
		</PageShell>
	);
}
