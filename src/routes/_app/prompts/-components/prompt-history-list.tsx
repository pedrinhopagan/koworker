import { Copy, Inbox, Pencil } from "lucide-react";

import type { RouterOutputs } from "@/client";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { formatDateTime, relativeTimeFrom } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import { PROMPT_HISTORY_KIND_LABEL } from "./prompt-history-kind";

type PromptHistoryItem = RouterOutputs["promptHistory"]["list"]["items"][number];

type PromptHistoryListProps = {
	items: PromptHistoryItem[];
	loading: boolean;
	onCopy: (item: PromptHistoryItem) => void;
	onEdit: (item: PromptHistoryItem) => void;
};

function promptMeta(item: PromptHistoryItem) {
	return [
		item.projectName,
		item.target,
		item.routePath,
		item.agentSlug ? `agent:${item.agentSlug}` : null,
		item.skillSlug ? `skill:${item.skillSlug}` : null,
		item.model,
		item.effort,
	].filter(Boolean);
}

export function PromptHistoryList({ items, loading, onCopy, onEdit }: PromptHistoryListProps) {
	if (loading) {
		return (
			<div className="flex flex-col gap-3">
				{Array.from({ length: 6 }).map((_, index) => (
					<div key={index} className="h-36 animate-pulse border border-border bg-muted/20" />
				))}
			</div>
		);
	}

	if (items.length === 0) {
		return (
			<EmptyFeedback
				icon={Inbox}
				title="Nenhum prompt encontrado"
				subtitle="Ajuste os filtros ou adicione um prompt manualmente."
				className="min-h-72"
			/>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			{items.map((item) => (
				<PromptHistoryCard key={item.id} item={item} onCopy={onCopy} onEdit={onEdit} />
			))}
		</div>
	);
}

type PromptHistoryCardProps = {
	item: PromptHistoryItem;
	onCopy: (item: PromptHistoryItem) => void;
	onEdit: (item: PromptHistoryItem) => void;
};

function PromptHistoryCard({ item, onCopy, onEdit }: PromptHistoryCardProps) {
	const meta = promptMeta(item);
	const title = item.text.trim() || item.prompt;

	return (
		<article className="border border-border bg-card p-3 transition-colors hover:bg-secondary/30 md:p-4">
			<div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start">
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<Chip variant="primary" size="sm">
							{PROMPT_HISTORY_KIND_LABEL[item.kind]}
						</Chip>
						<Text size="xs" tone="muted" className="font-mono tabular-nums">
							{relativeTimeFrom(item.createdAt)}
						</Text>
						<Text size="xs" tone="muted" className="hidden font-mono tabular-nums sm:inline">
							{formatDateTime(item.createdAt)}
						</Text>
					</div>

					<Text
						as="div"
						size="sm"
						className="mt-3 line-clamp-2 min-w-0 break-words font-medium text-foreground"
					>
						{title}
					</Text>

					<pre className="mt-3 max-h-32 min-w-0 overflow-hidden whitespace-pre-wrap break-words border border-border bg-background/70 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
						{item.prompt}
					</pre>

					{meta.length > 0 && (
						<div className="mt-3 flex flex-wrap gap-1.5">
							{meta.map((value) => (
								<Chip key={value} variant="ghost" size="xs" className="max-w-full truncate">
									{value}
								</Chip>
							))}
						</div>
					)}
				</div>

				<div className={cn("grid shrink-0 grid-cols-2 gap-2", "lg:w-32 lg:grid-cols-1")}>
					<Button
						type="button"
						variant="outline"
						onClick={() => onCopy(item)}
						className="h-11 md:h-9"
					>
						<Copy className="size-4" />
						Copiar
					</Button>
					<Button
						type="button"
						variant="ghost"
						onClick={() => onEdit(item)}
						className="h-11 md:h-9"
					>
						<Pencil className="size-4" />
						Editar
					</Button>
				</div>
			</div>
		</article>
	);
}
