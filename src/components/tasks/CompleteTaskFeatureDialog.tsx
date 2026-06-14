import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { TaskGroup } from "@/types/tasks";

// Concluir uma tarefa "Sem feature" passa por aqui: a lista vem na ordem da página de Tarefas e um
// clique numa feature já vincula e conclui (um clique, sem confirmar). O botão sutil "Concluir sem
// feature" mantém o atalho de quem não quer classificar.
export function CompleteTaskFeatureDialog({
	open,
	onClose,
	taskTitle,
	features,
	loading,
	onComplete,
}: {
	open: boolean;
	onClose: () => void;
	taskTitle: string;
	features: TaskGroup[];
	loading: boolean;
	onComplete: (groupId?: string) => void;
}) {
	return (
		<Dialog
			open={open}
			onClose={onClose}
			title="Concluir tarefa"
			description={taskTitle}
			className="max-w-md"
			footer={
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="text-muted-foreground"
					disabled={loading}
					onClick={() => onComplete()}
				>
					Concluir sem feature
				</Button>
			}
		>
			<div className="space-y-2">
				<Text size="sm" tone="muted">
					Clique em uma feature para vincular e concluir.
				</Text>
				<div className="-mx-1 flex max-h-72 flex-col gap-0.5 overflow-y-auto px-1">
					{features.map((feature) => (
						<button
							key={feature.id}
							type="button"
							disabled={loading}
							onClick={() => onComplete(feature.id)}
							className="flex items-center gap-2 border border-transparent px-3 py-2 text-left transition-colors hover:border-border hover:bg-secondary/40 disabled:pointer-events-none disabled:opacity-50"
						>
							<span
								className="size-2.5 shrink-0 rounded-full"
								style={{ backgroundColor: feature.color }}
							/>
							<span className="truncate text-sm">{feature.name}</span>
						</button>
					))}
				</div>
			</div>
		</Dialog>
	);
}
