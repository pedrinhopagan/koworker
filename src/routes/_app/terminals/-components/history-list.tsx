import { History, Loader2 } from "lucide-react";

import type { RouterOutputs } from "@/client";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { formatDayLabel } from "@/lib/relative-time";
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
			<div className="flex min-h-32 items-center justify-center">
				<Loader2 className="size-5 animate-spin text-muted-foreground" />
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
		<div className="flex flex-col gap-5">
			{groupByDay(sessions).map((group) => (
				<div key={group.key} className="flex flex-col gap-2">
					<Text as="span" size="xs" tone="muted" className="font-semibold uppercase">
						{group.label}
					</Text>

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
			))}

			{hasMore && (
				<Button
					variant="outline"
					size="sm"
					onClick={onLoadMore}
					disabled={refreshing}
					className="self-center"
				>
					{refreshing ? <Loader2 className="size-4 animate-spin" /> : null}
					Carregar mais
				</Button>
			)}
		</div>
	);
}
