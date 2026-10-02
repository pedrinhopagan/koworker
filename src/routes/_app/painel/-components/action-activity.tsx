import { Activity, Trash2 } from "lucide-react";

import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { CallChip } from "@/components/ui/call-chip";
import { LiveOutput } from "@/components/ui/live-output";
import { cn } from "@/lib/utils";
import type { ActionRun } from "../-utils/use-action-runs";

type ActionActivityProps = {
	runs: ActionRun[];
	selectedId: string | undefined;
	onSelect: (runId: string) => void;
	onClear: () => void;
};

const timeFormat = new Intl.DateTimeFormat("pt-BR", {
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
});

export function ActionActivity({ runs, selectedId, onSelect, onClear }: ActionActivityProps) {
	return (
		<section className="flex min-w-0 flex-col lg:h-full lg:min-h-0">
			<div className="flex items-end justify-between gap-3 border-b border-border pb-3">
				<div>
					<Text size="xs" tone="faint" className="font-mono uppercase tracking-[0.14em]">
						Resultado
					</Text>
					<Title as="h2" size="sm" className="mt-1">
						Atividade
					</Title>
				</div>
				{runs.length > 0 && (
					<Button variant="ghost" size="icon-sm" onClick={onClear} aria-label="Limpar atividade">
						<Trash2 className="size-3.5" />
					</Button>
				)}
			</div>

			{runs.length === 0 && (
				<div className="mt-3 border border-dashed border-border bg-muted/15 px-4 py-8 text-center">
					<Activity className="mx-auto size-5 text-muted-foreground" />
					<Text size="xs" tone="muted" className="mx-auto mt-2 max-w-56">
						Ações em background aparecem aqui com a saída do comando.
					</Text>
				</div>
			)}

			<div className="mt-3 space-y-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
				{runs.map((run) => {
					const open = run.id === selectedId;
					return (
						<div
							key={run.id}
							className={cn(
								"rounded-xl border border-border bg-card",
								open && "border-foreground/25",
							)}
						>
							<button
								type="button"
								onClick={() => onSelect(run.id)}
								aria-expanded={open}
								className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
							>
								<div className="min-w-0 flex-1">
									<Text as="div" size="sm" className="truncate font-semibold leading-tight">
										{run.label}
									</Text>
									<Text
										as="div"
										size="xs"
										tone="faint"
										className="font-mono tabular-nums leading-tight"
									>
										{timeFormat.format(run.startedAt)}
									</Text>
								</div>
								<CallChip state={run.state} />
							</button>
							{open && (
								<div className="border-t border-border p-2">
									{run.command && (
										<Text size="xs" tone="muted" className="mb-2 break-all font-mono">
											$ {run.command}
										</Text>
									)}
									<LiveOutput
										text={
											run.output ?? (run.state.status === "running" ? "Rodando…" : "Sem saída.")
										}
										className="max-h-72"
									/>
								</div>
							)}
						</div>
					);
				})}
			</div>
		</section>
	);
}
