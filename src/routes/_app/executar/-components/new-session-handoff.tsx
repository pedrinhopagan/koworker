import { Link } from "@tanstack/react-router";
import { ArrowRight, CircleStop, ListTree } from "lucide-react";

import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";

export function NewSessionHandoff({
	projectId,
	taskId,
	taskTitle,
	endReason,
}: {
	projectId: string;
	taskId?: string;
	taskTitle?: string;
	endReason?: string;
}) {
	return (
		<div className="z-20 -mx-4 shrink-0 border-t border-border bg-background/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
			<div className="mx-auto flex w-full max-w-3xl flex-col gap-3 border border-border bg-card p-3 shadow-[3px_3px_0_var(--border)] sm:flex-row sm:items-center sm:p-4">
				<span className="flex size-9 shrink-0 items-center justify-center border border-primary/40 bg-primary/10 text-primary">
					<CircleStop className="size-4" />
				</span>
				<div className="min-w-0 flex-1">
					<Title as="h2" size="sm">
						Sessão encerrada
					</Title>
					<Text size="xs" tone="muted" className="mt-0.5">
						{taskId
							? `O contexto ficou em ${taskTitle ?? "sua tarefa"}. A próxima sessão começa lendo a tarefa.`
							: (endReason ?? "Abra uma sessão limpa para continuar o trabalho.")}
					</Text>
				</div>
				<Button asChild className="w-full sm:w-auto">
					<Link
						to="/executar"
						search={{
							projectId,
							...(taskId ? { taskId } : {}),
						}}
					>
						{taskId ? <ListTree className="size-4" /> : <ArrowRight className="size-4" />}
						Nova sessão
					</Link>
				</Button>
			</div>
		</div>
	);
}
