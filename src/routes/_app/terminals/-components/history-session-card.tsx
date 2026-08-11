import { Link } from "@tanstack/react-router";
import { FolderGit2, GitBranch, ListTree, Radio } from "lucide-react";
import { memo } from "react";

import type { CliSessionSummary } from "@/api/helpers/agent-history";
import type { SessionTaskOrigin } from "@/api/helpers/agent-history/links";
import { AgentCliIcon } from "@/components/agent-radar/agent-cli";
import { Text } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { agentRadarAgentLabel } from "@/constants/agent-radar";
import { formatDuration, relativeTimeFrom } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

const ORIGIN_HINTS: Record<SessionTaskOrigin, string> = {
	registro: "O koworker abriu esta sessão para a tarefa",
	worktree: "A sessão rodou no worktree da tarefa",
	mencao: "A conversa trabalhou os arquivos da tarefa",
};

export type HistorySearch = {
	projectId?: string;
	cli?: "claude" | "codex";
	q?: string;
};

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

	return (
		<Link
			to="/terminals/history/$cli/$sessionId"
			params={{ cli: session.cli, sessionId: session.sessionId }}
			search={search}
			data-component="history-session-card"
			className={cn(
				"flex flex-col gap-2 border border-border bg-card p-3 shadow-xs transition-colors hover:border-primary/60 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
				selected && "border-primary bg-muted/50",
			)}
		>
			<div className="flex min-w-0 items-center gap-2">
				<AgentCliIcon agent={session.cli} />
				<Text as="span" size="xs" className="shrink-0 font-semibold">
					{agentRadarAgentLabel(session.cli)}
				</Text>

				{session.projectName && !compact && (
					<Badge variant="muted" className="shrink-0 truncate">
						{session.projectName}
					</Badge>
				)}

				{session.livePaneId && (
					<Badge variant="success" className="shrink-0 gap-1">
						<Radio className="size-3" />
						Aberta agora
					</Badge>
				)}

				<span className="flex-1" />

				<Text as="span" size="xs" tone="muted" className="shrink-0">
					{relativeTimeFrom(session.updatedAt)}
				</Text>
			</div>

			<Text size="sm" className="line-clamp-2 font-medium">
				{title}
			</Text>

			{!compact && session.preview && session.title && (
				<Text size="xs" tone="muted" className="line-clamp-1">
					{session.preview}
				</Text>
			)}

			{session.tasks.length > 0 && (
				<div className="flex flex-wrap gap-1.5">
					{session.tasks.map((task) => (
						<span
							key={task.taskId}
							title={ORIGIN_HINTS[task.origin]}
							className="inline-flex min-w-0 items-center gap-1 border border-border bg-muted/40 px-1.5 py-0.5 text-xs text-foreground"
						>
							<ListTree className="size-3 shrink-0 text-primary" />
							<span className="max-w-48 truncate">{task.title ?? "Tarefa sem título"}</span>
						</span>
					))}
				</div>
			)}

			{!compact && (
				<div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
					{session.cwdLabel && (
						<span className="inline-flex min-w-0 items-center gap-1">
							<FolderGit2 className="size-3 shrink-0" />
							<Text as="span" size="xs" tone="muted" className="truncate font-mono">
								{session.cwdLabel}
							</Text>
						</span>
					)}
					{session.gitBranch && (
						<span className="inline-flex min-w-0 items-center gap-1">
							<GitBranch className="size-3 shrink-0" />
							<Text as="span" size="xs" tone="muted" className="truncate font-mono">
								{session.gitBranch}
							</Text>
						</span>
					)}
					{duration && (
						<Text as="span" size="xs" tone="muted">
							{duration} de conversa
						</Text>
					)}
				</div>
			)}
		</Link>
	);
});
