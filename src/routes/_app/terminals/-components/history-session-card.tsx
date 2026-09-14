import { Link } from "@tanstack/react-router";
import { GitBranch, ListTree } from "lucide-react";
import { memo } from "react";

import type { HistoryCli } from "@/api/schemas/agent-history";
import type { RouterOutputs } from "@/client";
import { AgentCliIcon } from "@/components/agent-radar/agent-cli";
import { Text } from "@/components/typography";
import { agentRadarAgentLabel } from "@/constants/agent-radar";
import { formatDuration, relativeTimeFrom } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

type CliSessionSummary = RouterOutputs["agentHistory"]["list"]["sessions"][number];

export type HistorySearch = {
	projectId?: string;
	cli?: HistoryCli;
	q?: string;
};

export function LiveDot({ className }: { className?: string }) {
	return (
		<span
			aria-label="Aberta agora"
			title="Aberta agora"
			className={cn("relative inline-flex size-2 shrink-0", className)}
		>
			<span className="absolute inset-0 animate-ping rounded-full bg-success/60" />
			<span className="relative inline-flex size-2 rounded-full bg-success" />
		</span>
	);
}

export const HistorySessionCard = memo(function HistorySessionCard({
	session,
	search,
	selected,
	compact,
}: {
	session: CliSessionSummary;
	search: HistorySearch;
	selected?: boolean;
	compact?: boolean;
}) {
	const title = session.title ?? session.preview ?? "Conversa sem primeira mensagem";
	const duration = session.startedAt ? formatDuration(session.startedAt, session.updatedAt) : null;
	const tasks = session.tasks.length;

	return (
		<Link
			to="/terminals/history/$cli/$sessionId"
			params={{ cli: session.cli, sessionId: session.sessionId }}
			search={search}
			data-component="history-session-card"
			aria-current={selected ? "page" : undefined}
			className={cn(
				"group flex gap-3 border-l-2 border-transparent py-2.5 pl-3 pr-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:bg-muted/50",
				selected && "border-primary bg-muted/60",
				!compact && "border-b border-b-border last:border-b-0",
			)}
		>
			<AgentCliIcon agent={session.cli} className="mt-1 size-4" />

			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<Text size="sm" className={cn("line-clamp-2", selected ? "font-semibold" : "font-medium")}>
					{title}
				</Text>

				<div className="flex min-w-0 items-center gap-2 text-muted-foreground">
					{session.livePaneId && <LiveDot />}
					<Text as="span" size="xs" tone="muted" className="shrink-0">
						{compact ? agentRadarAgentLabel(session.cli) : relativeTimeFrom(session.updatedAt)}
					</Text>
					{!compact && session.projectName && (
						<>
							<span aria-hidden>·</span>
							<Text as="span" size="xs" tone="muted" className="truncate">
								{session.projectName}
							</Text>
						</>
					)}
					{!compact && session.gitBranch && (
						<>
							<span aria-hidden>·</span>
							<span className="inline-flex min-w-0 items-center gap-1">
								<GitBranch className="size-3 shrink-0" />
								<Text as="span" size="xs" tone="muted" className="truncate font-mono">
									{session.gitBranch}
								</Text>
							</span>
						</>
					)}
					{!compact && duration && (
						<>
							<span aria-hidden>·</span>
							<Text as="span" size="xs" tone="muted" className="shrink-0">
								{duration}
							</Text>
						</>
					)}
					{tasks > 0 && (
						<>
							<span aria-hidden>·</span>
							<span className="inline-flex shrink-0 items-center gap-1">
								<ListTree className="size-3 text-primary" />
								<Text as="span" size="xs" tone="muted">
									{tasks === 1 ? "1 tarefa" : `${tasks} tarefas`}
								</Text>
							</span>
						</>
					)}
				</div>
			</div>

			{compact && (
				<Text as="span" size="xs" tone="faint" className="shrink-0 pt-0.5 tabular-nums">
					{relativeTimeFrom(session.updatedAt).replace(/^há /, "")}
				</Text>
			)}
		</Link>
	);
});
