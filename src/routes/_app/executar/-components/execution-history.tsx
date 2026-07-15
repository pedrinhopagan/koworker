import { Activity, Loader2 } from "lucide-react";

import type { RouterOutputs } from "@/client";
import { Text, Title } from "@/components/typography";
import { ExecutionRunCard } from "./execution-run-card";

type Run = RouterOutputs["prompt"]["listRuns"][number];

export function ExecutionHistory({
	runs,
	loading,
	pending,
	onRetry,
	onCancel,
}: {
	runs: Run[];
	loading: boolean;
	pending: boolean;
	onRetry: (runId: string) => void;
	onCancel: (runId: string) => void;
}) {
	return (
		<section className="min-w-0">
			<div className="mb-3 flex items-center gap-2 border-y border-border py-2">
				<Activity className="size-4" />
				<Title as="h2" size="xs" className="uppercase tracking-[0.14em]">
					Ativas e recentes
				</Title>
			</div>
			<div className="flex flex-col gap-4">
				{loading && (
					<div className="flex justify-center p-8">
						<Loader2 className="size-5 animate-spin" />
					</div>
				)}
				{!loading && runs.length === 0 && (
					<div className="border border-dashed border-border p-8 text-center">
						<Activity className="mx-auto mb-3 size-6 text-muted-foreground" />
						<Title as="h3" size="sm">
							Nenhuma execução ainda
						</Title>
						<Text size="sm" tone="muted">
							O histórico aparecerá aqui e continuará depois de recarregar.
						</Text>
					</div>
				)}
				{runs.map((run) => (
					<ExecutionRunCard
						key={run.runId}
						run={run}
						pending={pending}
						onRetry={onRetry}
						onCancel={onCancel}
					/>
				))}
			</div>
		</section>
	);
}
