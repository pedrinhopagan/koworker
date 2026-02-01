import { useMemo, useState } from "react";

import { SubtaskDetailList } from "@/components/tasks";
import { Text, Title } from "@/components/typography";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import type { TaskFull } from "@/types/tasks";

const emptyText = "Sem dados";
const statusLabels: Record<string, string> = {
	pending: "Pendente",
	in_execution: "Em execução",
	executed: "Executada",
};

const sectionLabels = {
	subtasks: "subtasks",
	status: "status",
	description: "description",
	notes: "notes",
	acceptance: "acceptance",
	scheduling: "scheduling",
	dates: "dates",
	ai: "ai",
	ids: "ids",
};

type TaskDetailsSectionProps = {
	task: NonNullable<TaskFull>;
};

export function TaskDetailsSection({ task }: TaskDetailsSectionProps) {
	const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

	const aiMetadataText = useMemo(() => {
		if (task.aiMetadata === null || task.aiMetadata === undefined) return emptyText;
		if (typeof task.aiMetadata === "string") return task.aiMetadata;
		try {
			return JSON.stringify(task.aiMetadata, null, 2);
		} catch {
			return String(task.aiMetadata);
		}
	}, [task.aiMetadata]);

	const subtasks = task.subtasks ?? [];
	const acceptanceCriteria = task.acceptanceCriteria ?? [];

	function setOpen(key: string, open: boolean) {
		setOpenSections((prev) => ({ ...prev, [key]: open }));
	}

	function isOpen(key: string) {
		return Boolean(openSections[key]);
	}

	function formatTimestamp(value?: number | null) {
		return value ? new Date(value).toLocaleString() : "—";
	}

	return (
		<section className="space-y-3">
			<Title as="h3" size="lg">
				Detalhes da tarefa
			</Title>

			<div className="">
				<CollapsibleSection
					title={`Subtarefas (${subtasks.length})`}
					open={isOpen(sectionLabels.subtasks)}
					onOpenChange={(open) => setOpen(sectionLabels.subtasks, open)}
					variant="compact"
				>
					<SubtaskDetailList subtasks={subtasks} />
				</CollapsibleSection>

				<CollapsibleSection
					title="Status e organização"
					open={isOpen(sectionLabels.status)}
					onOpenChange={(open) => setOpen(sectionLabels.status, open)}
					variant="compact"
				>
					<div className="grid gap-2 sm:grid-cols-2">
						<div className="space-y-1">
							<Text size="xs" tone="muted">
								Status
							</Text>
							<Text size="sm">{statusLabels[task.status] ?? task.status}</Text>
						</div>
						<div className="space-y-1">
							<Text size="xs" tone="muted">
								Categoria
							</Text>
							<Text size="sm">{task.category?.name ?? emptyText}</Text>
						</div>
						<div className="space-y-1">
							<Text size="xs" tone="muted">
								Prioridade
							</Text>
							<Text size="sm">{task.priority?.name ?? emptyText}</Text>
						</div>
						<div className="space-y-1">
							<Text size="xs" tone="muted">
								Projeto
							</Text>
							<Text size="sm">{task.project?.name ?? emptyText}</Text>
						</div>
					</div>
				</CollapsibleSection>

				<CollapsibleSection
					title="Descrição"
					open={isOpen(sectionLabels.description)}
					onOpenChange={(open) => setOpen(sectionLabels.description, open)}
					variant="compact"
				>
					<Text size="sm" className={task.description ? undefined : "text-muted-foreground"}>
						{task.description || emptyText}
					</Text>
				</CollapsibleSection>

				<CollapsibleSection
					title="Notas"
					open={isOpen(sectionLabels.notes)}
					onOpenChange={(open) => setOpen(sectionLabels.notes, open)}
					variant="compact"
				>
					<Text size="sm" className={task.notes ? undefined : "text-muted-foreground"}>
						{task.notes || emptyText}
					</Text>
				</CollapsibleSection>

				<CollapsibleSection
					title={`Critérios de aceitação (${acceptanceCriteria.length})`}
					open={isOpen(sectionLabels.acceptance)}
					onOpenChange={(open) => setOpen(sectionLabels.acceptance, open)}
					variant="compact"
				>
					{acceptanceCriteria.length === 0 ? (
						<Text size="sm" tone="muted">
							Nenhum critério definido.
						</Text>
					) : (
						<div className="space-y-2">
							{acceptanceCriteria.map((item) => (
								<div key={item.id} className="flex items-start gap-2">
									<Text size="sm" className="text-muted-foreground">
										{item.done ? "[x]" : "[ ]"}
									</Text>
									<Text size="sm">{item.text}</Text>
								</div>
							))}
						</div>
					)}
				</CollapsibleSection>

				<CollapsibleSection
					title="Agendamento"
					open={isOpen(sectionLabels.scheduling)}
					onOpenChange={(open) => setOpen(sectionLabels.scheduling, open)}
					variant="compact"
				>
					<Text size="sm" className={task.scheduledDate ? undefined : "text-muted-foreground"}>
						{task.scheduledDate || emptyText}
					</Text>
				</CollapsibleSection>

				<CollapsibleSection
					title="Datas"
					open={isOpen(sectionLabels.dates)}
					onOpenChange={(open) => setOpen(sectionLabels.dates, open)}
					variant="compact"
				>
					<div className="grid gap-2 sm:grid-cols-2">
						<div className="space-y-1">
							<Text size="xs" tone="muted">
								Criada em
							</Text>
							<Text size="sm">{formatTimestamp(task.createdAt)}</Text>
						</div>
						<div className="space-y-1">
							<Text size="xs" tone="muted">
								Atualizada em
							</Text>
							<Text size="sm">{formatTimestamp(task.updatedAt)}</Text>
						</div>
						<div className="space-y-1">
							<Text size="xs" tone="muted">
								Concluída em
							</Text>
							<Text size="sm">{formatTimestamp(task.completedAt)}</Text>
						</div>
						<div className="space-y-1">
							<Text size="xs" tone="muted">
								Removida em
							</Text>
							<Text size="sm">{formatTimestamp(task.deletedAt)}</Text>
						</div>
					</div>
				</CollapsibleSection>

				<CollapsibleSection
					title="Metadados de IA"
					open={isOpen(sectionLabels.ai)}
					onOpenChange={(open) => setOpen(sectionLabels.ai, open)}
					variant="compact"
				>
					<pre className="whitespace-pre-wrap text-xs text-muted-foreground">{aiMetadataText}</pre>
				</CollapsibleSection>

				<CollapsibleSection
					title="IDs"
					open={isOpen(sectionLabels.ids)}
					onOpenChange={(open) => setOpen(sectionLabels.ids, open)}
					variant="compact"
				>
					<div className="grid gap-2 sm:grid-cols-2">
						<div className="space-y-1">
							<Text size="xs" tone="muted">
								Tarefa
							</Text>
							<Text size="sm" className="truncate">
								{task.id}
							</Text>
						</div>
						<div className="space-y-1">
							<Text size="xs" tone="muted">
								Projeto
							</Text>
							<Text size="sm" className="truncate">
								{task.projectId}
							</Text>
						</div>
						<div className="space-y-1">
							<Text size="xs" tone="muted">
								Categoria
							</Text>
							<Text size="sm" className="truncate">
								{task.categoryId}
							</Text>
						</div>
						<div className="space-y-1">
							<Text size="xs" tone="muted">
								Prioridade
							</Text>
							<Text size="sm" className="truncate">
								{task.priorityId}
							</Text>
						</div>
					</div>
				</CollapsibleSection>
			</div>
		</section>
	);
}
