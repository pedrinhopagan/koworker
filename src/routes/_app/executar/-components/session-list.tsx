import { Link } from "@tanstack/react-router";
import { Loader2, Radio, TerminalSquare } from "lucide-react";

import { Text, Title } from "@/components/typography";
import type { RouterOutputs } from "@/client";
import { AGENT_SESSION_STATUS_LABELS } from "@/constants/execution";
import { cn } from "@/lib/utils";
import { TaskLink } from "@/components/task-link";

type Session = RouterOutputs["agentSessions"]["list"][number];

function SessionRow({ session }: { session: Session }) {
	const live = session.status === "live";

	return (
		<li
			className={cn(
				"flex min-w-0 items-stretch border border-border bg-card transition-colors hover:border-primary/60",
				live && "border-primary",
			)}
		>
			<Link
				to="/executar/$executionId"
				params={{ executionId: session.id }}
				className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 transition-colors hover:bg-muted"
			>
				<span
					className={cn(
						"flex size-6 shrink-0 items-center justify-center border border-border bg-muted/40 text-muted-foreground",
						live && "border-primary text-primary",
					)}
				>
					{session.busy ? (
						<Loader2 className="size-3 animate-spin" />
					) : live ? (
						<Radio className="size-3" />
					) : (
						<TerminalSquare className="size-3" />
					)}
				</span>
				<span className="min-w-0 flex-1">
					<Text as="span" className="block truncate text-sm font-medium">
						{session.taskTitle ?? session.title}
					</Text>
					<Text as="span" size="xs" tone="muted" className="block truncate">
						{session.projectName} ·{" "}
						{session.busy
							? "trabalhando"
							: AGENT_SESSION_STATUS_LABELS[session.status].toLowerCase()}
					</Text>
				</span>
			</Link>
			{session.taskId && (
				<TaskLink taskId={session.taskId} compact className="border-0 border-l bg-transparent" />
			)}
		</li>
	);
}

export function SessionList({ sessions, loading }: { sessions: Session[]; loading: boolean }) {
	if (loading) {
		return null;
	}

	const live = sessions.filter((session) => session.status === "live");
	const rest = sessions.filter((session) => session.status !== "live").slice(0, 5);

	if (live.length === 0 && rest.length === 0) {
		return null;
	}

	return (
		<section className="min-w-0 space-y-2">
			<Title as="h2" size="xs" className="uppercase tracking-[0.14em]">
				Sessões
			</Title>
			<ul className="grid gap-2">
				{[...live, ...rest].map((session) => (
					<SessionRow key={session.id} session={session} />
				))}
			</ul>
		</section>
	);
}
