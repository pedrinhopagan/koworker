import { Link } from "@tanstack/react-router";
import { Copy, FolderGit2, Inbox, MessageSquareText } from "lucide-react";
import { useState } from "react";

import type { RouterOutputs } from "@/client";
import { AgentCliIcon } from "@/components/agent-radar/agent-cli";
import { Text } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { formatDateTime, relativeTimeFrom } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import { PROMPT_SOURCE_LABEL } from "./prompt-source";

type PromptHistoryItem = RouterOutputs["promptHistory"]["list"]["items"][number];

type PromptHistoryListProps = {
	items: PromptHistoryItem[];
	loading: boolean;
	onCopy: (item: PromptHistoryItem) => void;
};

export function PromptHistoryList({ items, loading, onCopy }: PromptHistoryListProps) {
	if (loading) {
		return (
			<div className="flex flex-col gap-3">
				{Array.from({ length: 6 }).map((_, index) => (
					<div key={index} className="h-32 animate-pulse border border-border bg-muted/20" />
				))}
			</div>
		);
	}

	if (items.length === 0) {
		return (
			<EmptyFeedback
				icon={Inbox}
				title="Nenhum prompt encontrado"
				subtitle="Ajuste os filtros ou mande um prompt pelo Claude ou pelo Codex."
				className="min-h-72"
			/>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			{items.map((item) => (
				<PromptHistoryCard key={item.id} item={item} onCopy={onCopy} />
			))}
		</div>
	);
}

function homeless(cwd: string) {
	return cwd.replace(/^\/home\/[^/]+/, "~");
}

function PromptHistoryCard({
	item,
	onCopy,
}: {
	item: PromptHistoryItem;
	onCopy: (item: PromptHistoryItem) => void;
}) {
	const [expanded, setExpanded] = useState(false);

	return (
		<article className="border border-border bg-card p-3 shadow-xs transition-colors hover:bg-secondary/30 md:p-4">
			<div className="flex min-w-0 flex-wrap items-center gap-2">
				{item.sources.map(({ source, count }) => (
					<Badge key={source} variant="muted" className="gap-1">
						{source !== "copy" && <AgentCliIcon agent={source} className="size-3" />}
						{PROMPT_SOURCE_LABEL[source]}
						{count > 1 && <span className="tabular-nums">×{count}</span>}
					</Badge>
				))}

				{item.projectName && (
					<Badge variant="outline" className="truncate">
						{item.projectName}
					</Badge>
				)}

				<span className="flex-1" />

				<Text
					as="span"
					size="xs"
					tone="muted"
					className="font-mono tabular-nums"
					title={formatDateTime(item.lastSentAt)}
				>
					{relativeTimeFrom(item.lastSentAt)}
				</Text>
			</div>

			<button
				type="button"
				onClick={() => setExpanded((current) => !current)}
				className="mt-3 block w-full text-left"
			>
				<pre
					className={cn(
						"min-w-0 whitespace-pre-wrap break-words border border-border bg-background/70 p-3 font-mono text-xs leading-relaxed text-foreground",
						!expanded && "line-clamp-6",
					)}
				>
					{item.prompt}
				</pre>
			</button>

			<div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
				{item.cwd && (
					<span className="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
						<FolderGit2 className="size-3 shrink-0" />
						<Text as="span" size="xs" tone="muted" className="truncate font-mono">
							{homeless(item.cwd)}
						</Text>
					</span>
				)}

				<span className="flex-1" />

				{item.session && (
					<Button asChild variant="ghost" size="sm">
						<Link
							to="/terminals/history/$cli/$sessionId"
							params={{ cli: item.session.cli, sessionId: item.session.sessionId }}
						>
							<MessageSquareText className="size-4" />
							Abrir conversa
						</Link>
					</Button>
				)}
				<Button type="button" variant="outline" size="sm" onClick={() => onCopy(item)}>
					<Copy className="size-4" />
					Copiar
				</Button>
			</div>
		</article>
	);
}
