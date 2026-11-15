import { ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { Text } from "@/components/typography";
import type { CodexItem, CodexTurn } from "@/lib/conversation";
import { conversationSegments, conversationUserText } from "@/lib/conversation-presentation";
import { ConversationMessage } from "@/routes/_app/chat/-components/conversation-message";
import { ConversationTool } from "@/routes/_app/chat/-components/conversation-tool";

export function ConversationThread({
	turns,
	onAnswer,
}: {
	turns: CodexTurn[];
	onAnswer?: (text: string) => Promise<boolean>;
}) {
	const items = turns.flatMap((turn) => turn.items);
	return turns.map((turn) => {
		const lastAgent = turn.items.findLast((item) => item.type === "agentMessage");
		return (
			<section
				key={turn.id}
				data-turn-id={turn.id}
				className="flex min-w-0 flex-col gap-4"
				aria-label="Turno da conversa"
			>
				{conversationSegments(turn).map((segment) => {
					if (segment.kind === "message") {
						return segment.items.map((item) => (
							<ConversationMessage
								key={item.id}
								item={item}
								final={
									item.phase === "final_answer" ||
									(!item.phase && item === lastAgent && turn.status === "completed")
								}
								answeredQuestions={item.questions?.map((question) =>
									items
										.slice(items.indexOf(item) + 1)
										.some(
											(next) =>
												next.type === "userMessage" &&
												conversationUserText(next).includes(`> ${question.title}`),
										),
								)}
								onAnswer={onAnswer}
							/>
						));
					}
					if (segment.items.length === 1) {
						return (
							<ConversationTool
								key={segment.id}
								item={segment.items[0]!}
								active={turn.status === "inProgress"}
							/>
						);
					}
					return (
						<ConversationActivity
							key={segment.id}
							items={segment.items}
							active={turn.status === "inProgress"}
						/>
					);
				})}
				{turn.status === "interrupted" && (
					<Text size="xs" tone="muted">
						Execução interrompida
					</Text>
				)}
				{turn.status === "failed" && (
					<Text role="alert" size="sm" tone="destructive">
						{turn.error?.message ?? "A execução falhou."}
					</Text>
				)}
			</section>
		);
	});
}

function ConversationActivity({ items, active }: { items: CodexItem[]; active: boolean }) {
	const [expanded, setExpanded] = useState(false);
	return (
		<details
			className="group/activity min-w-0"
			onToggle={(event) => setExpanded(event.currentTarget.open)}
		>
			<summary className="flex min-h-11 cursor-pointer items-center gap-2 text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
				<ChevronRight className="size-3.5 transition-transform group-open/activity:rotate-90" />
				{items.length} atividades
				{active && items.some((item) => item.status === "inProgress") && (
					<Loader2 className="size-3.5 animate-spin" />
				)}
			</summary>
			{expanded && (
				<div className="flex min-w-0 flex-col gap-2 pb-2">
					{items.map((item) => (
						<ConversationTool key={item.id} item={item} active={active} />
					))}
				</div>
			)}
		</details>
	);
}
