import { History, Loader2 } from "lucide-react";

import type { RouterOutputs } from "@/client";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { formatDayLabel } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import { HistorySessionCard, type HistorySearch } from "./history-session-card";

type CliSessionSummary = RouterOutputs["agentHistory"]["list"]["sessions"][number];

function groupByDay(sessions: CliSessionSummary[]) {
	const groups: { key: string; label: string; sessions: CliSessionSummary[] }[] = [];

	for (const session of sessions) {
		const label = formatDayLabel(session.updatedAt);
		const last = groups.at(-1);

		if (last?.label === label) {
			last.sessions.push(session);
		} else {
			groups.push({ key: `${label}-${session.sessionId}`, label, sessions: [session] });
		}
	}

	return groups;
}

export function HistoryList({
	sessions,
	search,
	loading,
	hasMore,
	refreshing,
	onLoadMore,
	selectedSessionId,
	compact,
}: {
	sessions: CliSessionSummary[];
	search: HistorySearch;
	loading: boolean;
	hasMore: boolean;
	refreshing: boolean;
	onLoadMore: () => void;
	selectedSessionId?: string;
	compact?: boolean;
}) {
	if (loading) {
		return (
			<div className="flex flex-col gap-2 p-3">
				{Array.from({ length: 8 }).map((_, index) => (
					<div key={index} className="h-12 animate-pulse bg-muted/30" />
				))}
			</div>
		);
	}

	if (sessions.length === 0) {
		return (
			<EmptyFeedback
				icon={History}
				title="Nenhuma conversa encontrada"
				subtitle="Ajuste os filtros ou abra uma conversa nova no terminal."
			/>
		);
	}

	return (
		<div className={cn("flex flex-col", compact ? "gap-4 pb-4" : "gap-6")}>
			{groupByDay(sessions).map((group) => (
				<section key={group.key} className="flex flex-col">
					<Text
						as="span"
						size="xs"
						tone="faint"
						className={cn(
							"sticky top-0 z-10 bg-chrome px-3 py-1.5 font-semibold uppercase tracking-wider",
							!compact && "bg-background",
						)}
					>
						{group.label}
					</Text>

					<div className={cn(!compact && "border border-border bg-card shadow-xs")}>
						{group.sessions.map((session) => (
							<HistorySessionCard
								key={`${session.cli}:${session.sessionId}`}
								session={session}
								search={search}
								selected={session.sessionId === selectedSessionId}
								{...(compact ? { compact } : {})}
							/>
						))}
					</div>
				</section>
			))}

			{hasMore && (
				<Button
					variant="ghost"
					size="sm"
					onClick={onLoadMore}
					disabled={refreshing}
					className="self-center text-muted-foreground"
				>
					{refreshing && <Loader2 className="size-4 animate-spin" />}
					Carregar mais
				</Button>
			)}
		</div>
	);
}
