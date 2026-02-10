import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, ChevronDown } from "lucide-react";
import { useCallback, useState } from "react";

import { orpc } from "@/client";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import type { TaskItemVisualState } from "@/domain/tasks/task-item-visual-state";
import { cn } from "@/lib/utils";

type VisualStateItem = {
	id: string;
	name: string;
	color: string;
	description: string;
};

const VISUAL_STATES: VisualStateItem[] = [
	{ id: "idle", name: "Pendente", color: "#7a7a7a", description: "Task sem progresso" },
	{ id: "started", name: "Iniciada", color: "#c2722a", description: "Task com estrutura definida" },
	{
		id: "ready-to-start",
		name: "Pronta",
		color: "#4a8ec2",
		description: "Subtasks criadas, aguardando execução",
	},
	{
		id: "in-execution",
		name: "Em andamento",
		color: "#b33a3a",
		description: "Task sendo executada ativamente",
	},
	{
		id: "ready-to-review",
		name: "Aguardando revisão",
		color: "#c9a227",
		description: "Subtasks concluídas, aguardando revisão",
	},
	{
		id: "ready-to-commit",
		name: "Pronta para commit",
		color: "#6c5ce7",
		description: "Revisada e pronta para commit",
	},
	{ id: "done", name: "Concluída", color: "#4a4a4a", description: "Task finalizada" },
];

const TRANSITION_WARNINGS: Record<string, string[]> = {
	idle: [
		"Status da task será definido como pendente",
		"Todas as subtasks existentes serão removidas",
		"Metadados de progresso serão limpos",
	],
	started: [
		"Status da task será definido como pendente",
		"Todas as subtasks existentes serão removidas",
		"Descrição será mantida (ou criada se vazia)",
	],
	"ready-to-start": [
		"Status da task será definido como pendente",
		"Subtasks existentes serão resetadas para pendente",
		"Se não houver subtasks, uma será criada automaticamente",
	],
	"in-execution": [
		"Status da task será definido como em execução",
		"Subtasks e critérios existentes serão mantidos",
	],
	"ready-to-review": [
		"Status da task será definido como pendente",
		"Todas as subtasks serão marcadas como concluídas",
		"Se não houver subtasks, uma será criada e concluída",
		"Metadado de revisão será limpo",
	],
	"ready-to-commit": [
		"Status da task será definido como pendente",
		"Todas as subtasks serão marcadas como concluídas",
		"Se não houver subtasks, uma será criada e concluída",
		"Metadado de revisão será definido como concluído",
	],
	done: ["Task será marcada como concluída com data atual"],
};

export type StatusSelectProps = {
	taskId: string;
	currentState: TaskItemVisualState;
	disabled?: boolean;
	triggerClassName?: string;
	upperLabel?: boolean;
};

export function StatusSelect({
	taskId,
	currentState,
	disabled = false,
	triggerClassName,
	upperLabel = false,
}: StatusSelectProps) {
	const queryClient = useQueryClient();
	const [pendingState, setPendingState] = useState<VisualStateItem | null>(null);

	const setVisualStateMutation = useMutation({
		...orpc.tasks.setVisualState.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "tasks",
			});
			setPendingState(null);
		},
		onError: () => {
			setPendingState(null);
		},
	});

	const selected = VISUAL_STATES.find((s) => s.id === currentState) ?? VISUAL_STATES[0];
	const accentColor = selected.color;

	const handleSelectChange = useCallback(
		(_: string, item: VisualStateItem) => {
			if (item.id === currentState) return;
			setPendingState(item);
		},
		[currentState],
	);

	const handleConfirm = useCallback(() => {
		if (!pendingState) return;
		setVisualStateMutation.mutate({
			id: taskId,
			targetState: pendingState.id as TaskItemVisualState,
		});
	}, [pendingState, taskId, setVisualStateMutation]);

	const handleCancel = useCallback(() => {
		setPendingState(null);
	}, []);

	const warnings = pendingState ? (TRANSITION_WARNINGS[pendingState.id] ?? []) : [];

	return (
		<>
			<CustomSelect<VisualStateItem>
				items={VISUAL_STATES}
				value={currentState}
				onValueChange={handleSelectChange}
				disabled={disabled || setVisualStateMutation.isPending}
				variant="default"
				size="md"
				label="Status"
				upperLabel={upperLabel}
				renderTrigger={() => (
					<>
						<span className="flex-1 flex min-w-0">
							<span className="inline-flex items-center gap-2 min-w-0 text-sm">
								<span
									className="size-2 rounded-full shrink-0"
									style={{ backgroundColor: accentColor }}
								/>
								<span className="truncate text-foreground min-w-0">{selected.name}</span>
							</span>
						</span>
						<ChevronDown className="size-4 text-muted-foreground ml-1 shrink-0" />
					</>
				)}
				renderItem={(item, isSelected) => (
					<div
						className={cn(
							"w-full px-3 py-2 flex items-center gap-2",
							"transition-all duration-150 ease-out",
						)}
						style={{
							borderLeft: isSelected ? `2px solid ${item.color}` : "2px solid transparent",
						}}
					>
						<span
							className="size-2 rounded-full shrink-0"
							style={{ backgroundColor: item.color }}
						/>
						<div className="flex-1 min-w-0">
							<span className={cn("text-sm truncate block", isSelected && "font-medium")}>
								{item.name}
							</span>
							<span className="text-xs text-muted-foreground truncate block">
								{item.description}
							</span>
						</div>
						{isSelected && (
							<Check className="size-4 ml-auto shrink-0" style={{ color: item.color }} />
						)}
					</div>
				)}
				triggerStyle={{ boxShadow: `0 0 0 1px ${accentColor}30` }}
				triggerClassName={cn("gap-1 min-w-[140px]", triggerClassName)}
				contentClassName="min-w-[280px]"
			/>

			{pendingState && (
				<div className="fixed inset-0 z-50 flex items-center justify-center">
					<button
						type="button"
						aria-label="Fechar dialog"
						onClick={handleCancel}
						className="absolute inset-0 bg-black/50"
					/>

					<div
						role="alertdialog"
						aria-modal="true"
						className="relative z-10 w-full max-w-md bg-background border border-border shadow-lg p-6 animate-in fade-in-0 zoom-in-95"
					>
						<div className="flex items-center gap-3 mb-4">
							<div
								className="p-2 rounded-md"
								style={{ backgroundColor: `${pendingState.color}20` }}
							>
								<AlertTriangle size={18} style={{ color: pendingState.color }} />
							</div>
							<div>
								<Title size="sm">Alterar status</Title>
								<Text size="xs" tone="muted">
									{selected.name} → {pendingState.name}
								</Text>
							</div>
						</div>

						<div className="mb-6 space-y-1.5">
							<Text size="xs" tone="muted" className="uppercase tracking-wide">
								O que vai acontecer:
							</Text>
							<ul className="space-y-1">
								{warnings.map((warning) => (
									<li key={warning} className="flex items-start gap-2 text-sm text-foreground">
										<span
											className="size-1.5 rounded-full shrink-0 mt-1.5"
											style={{ backgroundColor: pendingState.color }}
										/>
										{warning}
									</li>
								))}
							</ul>
						</div>

						<div className="flex justify-end gap-3">
							<Button
								type="button"
								variant="outline"
								onClick={handleCancel}
								disabled={setVisualStateMutation.isPending}
							>
								Cancelar
							</Button>
							<Button
								type="button"
								onClick={handleConfirm}
								disabled={setVisualStateMutation.isPending}
								style={{
									backgroundColor: pendingState.color,
									borderColor: pendingState.color,
								}}
								className="text-white hover:opacity-90"
							>
								{setVisualStateMutation.isPending ? "Aplicando..." : "Confirmar"}
							</Button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
