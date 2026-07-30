import { Activity, ArchiveX, History, Loader2, Radio } from "lucide-react";
import { useState } from "react";

import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Conversation } from "./conversations";
import { ExecutionRunCard } from "./execution-run-card";

type RecentGroup = {
	label: string;
	conversations: Conversation[];
};

function groupRecentRuns(conversations: Conversation[]): RecentGroup[] {
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
	const yesterdayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	yesterdayDate.setDate(yesterdayDate.getDate() - 1);
	const yesterday = yesterdayDate.getTime();
	const groups: RecentGroup[] = [
		{ label: "Hoje", conversations: [] },
		{ label: "Ontem", conversations: [] },
		{ label: "Mais antigas", conversations: [] },
	];

	for (const conversation of conversations) {
		const startedAt = conversation.latest.startedAt;
		const target = startedAt >= today ? groups[0] : startedAt >= yesterday ? groups[1] : groups[2];
		target.conversations.push(conversation);
	}

	return groups.filter((group) => group.conversations.length > 0);
}

export function ActiveExecutions({
	conversations,
	loading,
	pending,
	onCancel,
}: {
	conversations: Conversation[];
	loading: boolean;
	pending: boolean;
	onCancel: (runId: string) => void;
}) {
	const [toCancel, setToCancel] = useState<Conversation>();

	return (
		<section className="min-w-0" aria-labelledby="active-executions-title">
			<div className="mb-3 flex items-center justify-between border-y border-border py-2">
				<div className="flex items-center gap-2">
					<Radio className="size-4 text-primary" />
					<Title
						id="active-executions-title"
						as="h2"
						size="xs"
						className="uppercase tracking-[0.14em]"
					>
						Em andamento
					</Title>
				</div>
				{conversations.length > 0 && (
					<span className="flex min-w-6 items-center justify-center bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
						{conversations.length}
					</span>
				)}
			</div>

			{loading && (
				<div className="flex min-h-24 items-center justify-center border border-dashed border-border">
					<Loader2 className="size-5 animate-spin text-muted-foreground" />
				</div>
			)}
			{!loading && conversations.length === 0 && (
				<div className="flex items-center gap-3 border border-dashed border-border bg-muted/20 p-4">
					<span className="flex size-9 shrink-0 items-center justify-center border border-border bg-background">
						<Activity className="size-4 text-muted-foreground" />
					</span>
					<div>
						<Title as="h3" size="xs">
							Tudo tranquilo
						</Title>
						<Text size="xs" tone="muted">
							Nenhuma ação rodando agora.
						</Text>
					</div>
				</div>
			)}
			{conversations.length > 0 && (
				<div className="flex flex-col gap-3">
					{conversations.map((conversation) => (
						<ExecutionRunCard
							key={conversation.id}
							conversation={conversation}
							pending={pending}
							active
							onCancel={() => setToCancel(conversation)}
						/>
					))}
				</div>
			)}

			<ConfirmDialog
				open={!!toCancel}
				onClose={() => setToCancel(undefined)}
				onConfirm={() => {
					if (toCancel) {
						onCancel(toCancel.latest.runId);
						setToCancel(undefined);
					}
				}}
				title={`Interromper “${toCancel?.latest.taskTitle ?? toCancel?.latest.title ?? ""}”?`}
				description="O agente para no meio do trabalho e não retoma sozinho. O que ele já gravou em disco permanece como está."
				confirmLabel="Interromper execução"
				cancelLabel="Deixar rodando"
				variant="danger"
				loading={pending}
			/>
		</section>
	);
}

export function RecentExecutions({
	conversations,
	pending,
	onRetry,
	onClear,
}: {
	conversations: Conversation[];
	pending: boolean;
	onRetry: (runId: string) => void;
	onClear: (runIds: string[]) => void;
}) {
	const [groupToClear, setGroupToClear] = useState<RecentGroup>();
	const groups = groupRecentRuns(conversations);

	return (
		<section className="min-w-0" aria-labelledby="recent-executions-title">
			<div className="mb-3 flex items-center justify-between border-y border-border py-2">
				<div className="flex items-center gap-2">
					<History className="size-4 text-foreground" />
					<Title
						id="recent-executions-title"
						as="h2"
						size="xs"
						className="uppercase tracking-[0.14em]"
					>
						Recentes
					</Title>
				</div>
				<Text size="xs" tone="muted">
					{conversations.length} no histórico
				</Text>
			</div>

			{conversations.length === 0 && (
				<div className="border border-dashed border-border p-8 text-center">
					<History className="mx-auto mb-3 size-6 text-muted-foreground" />
					<Title as="h3" size="sm">
						Nenhuma execução recente
					</Title>
					<Text size="sm" tone="muted">
						As ações finalizadas aparecerão aqui.
					</Text>
				</div>
			)}

			<div className="flex flex-col gap-6">
				{groups.map((group) => (
					<div key={group.label}>
						<div className="mb-2 flex min-h-11 items-center justify-between gap-3">
							<Text as="span" className="text-[11px] font-bold uppercase tracking-[0.12em]">
								{group.label}{" "}
								<span className="text-muted-foreground">· {group.conversations.length}</span>
							</Text>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => setGroupToClear(group)}
								disabled={pending}
								className="h-9 border border-transparent px-2.5 text-xs text-muted-foreground hover:border-destructive/60 hover:bg-transparent hover:text-destructive"
							>
								<ArchiveX className="size-3.5" />
								Limpar seção
							</Button>
						</div>
						<div className="flex flex-col gap-3">
							{group.conversations.map((conversation) => (
								<ExecutionRunCard
									key={conversation.id}
									conversation={conversation}
									pending={pending}
									onRetry={onRetry}
								/>
							))}
						</div>
					</div>
				))}
			</div>

			<ConfirmDialog
				open={!!groupToClear}
				onClose={() => setGroupToClear(undefined)}
				onConfirm={() => {
					if (groupToClear) {
						onClear(groupToClear.conversations.flatMap((conversation) => conversation.runIds));
						setGroupToClear(undefined);
					}
				}}
				title={`Limpar a seção “${groupToClear?.label ?? ""}”?`}
				description="As execuções sairão do seu histórico, sem apagar tarefas ou projetos relacionados."
				confirmLabel="Limpar histórico"
				variant="danger"
				loading={pending}
			/>
		</section>
	);
}
