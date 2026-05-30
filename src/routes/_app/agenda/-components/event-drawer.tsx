import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CustomSelect } from "@/components/ui/custom-select";
import { Drawer } from "@/components/ui/drawer";
import { IconSelector } from "@/components/ui/icon-selector";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { defaultProjectColor, projectColorOptions } from "@/constants/colors";
import { cn } from "@/lib/utils";
import { useAgendaStore } from "@/stores/agenda";

const NO_TASK = { id: "", displayTitle: "— Evento pessoal —" };

function invalidateAgenda(queryClient: ReturnType<typeof useQueryClient>) {
	// Invalida events (chips) e tasks (backlog): linkar/desvincular tarefa muda os dois.
	queryClient.invalidateQueries({
		predicate: (q) => {
			const root = Array.isArray(q.queryKey?.[0]) ? q.queryKey[0][0] : null;
			return root === "events" || root === "tasks";
		},
	});
}

export function EventDrawer() {
	const queryClient = useQueryClient();
	const drawerDate = useAgendaStore((s) => s.drawerDate);
	const drawerEvent = useAgendaStore((s) => s.drawerEvent);
	const closeDrawer = useAgendaStore((s) => s.closeDrawer);

	const isEdit = Boolean(drawerEvent);
	const baseDate = drawerEvent?.startAt.slice(0, 10) ?? drawerDate ?? dayjs().format("YYYY-MM-DD");

	const [title, setTitle] = useState(drawerEvent?.title ?? "");
	const [allDay, setAllDay] = useState(drawerEvent?.allDay ?? true);
	const [startDate, setStartDate] = useState(baseDate);
	const [startTime, setStartTime] = useState(drawerEvent?.startAt.slice(11, 16) ?? "09:00");
	// all-day: end_at é exclusivo (dia seguinte ao último coberto) → o input mostra o último dia
	// INCLUSIVO = end_at − 1 dia. timed: end_at é o instante real, sem inversão.
	const [endDate, setEndDate] = useState(() => {
		if (!drawerEvent) return baseDate;
		if (drawerEvent.allDay) return dayjs(drawerEvent.endAt).subtract(1, "day").format("YYYY-MM-DD");
		return drawerEvent.endAt.slice(0, 10);
	});
	const [endTime, setEndTime] = useState(drawerEvent?.endAt.slice(11, 16) ?? "09:30");
	const [color, setColor] = useState<string | undefined>(
		drawerEvent ? (drawerEvent.color ?? undefined) : defaultProjectColor,
	);
	const [icon, setIcon] = useState<string | undefined>(drawerEvent?.icon ?? undefined);
	const [notes, setNotes] = useState(drawerEvent?.notes ?? "");
	const [taskId, setTaskId] = useState<string | undefined>(drawerEvent?.taskId ?? undefined);
	const [confirmDelete, setConfirmDelete] = useState(false);

	const tasksQuery = useQuery(orpc.tasks.getAll.queryOptions({ input: {} }));
	const taskItems = [
		NO_TASK,
		...(tasksQuery.data ?? []).map((t) => ({ id: t.id, displayTitle: t.displayTitle })),
	];
	const selectedTask = taskItems.find((t) => t.id === (taskId ?? ""));

	const createMutation = useMutation({
		...orpc.events.create.mutationOptions(),
		onSuccess: () => {
			invalidateAgenda(queryClient);
			closeDrawer();
		},
		onError: (error) => toast.error(error instanceof Error ? error.message : "Erro ao salvar"),
	});
	const updateMutation = useMutation({
		...orpc.events.update.mutationOptions(),
		onSuccess: () => {
			invalidateAgenda(queryClient);
			closeDrawer();
		},
		onError: (error) => toast.error(error instanceof Error ? error.message : "Erro ao salvar"),
	});
	const removeMutation = useMutation({
		...orpc.events.remove.mutationOptions(),
		onSuccess: () => {
			invalidateAgenda(queryClient);
			closeDrawer();
		},
	});

	const saving = createMutation.isPending || updateMutation.isPending;

	function handleSave() {
		// Garante coerência mínima: fim não antes do início (o resto o boundary valida/normaliza).
		const safeEndDate = endDate < startDate ? startDate : endDate;
		const startAt = allDay ? `${startDate}T00:00` : `${startDate}T${startTime}`;
		const endAt = allDay ? `${safeEndDate}T00:00` : `${safeEndDate}T${endTime}`;

		const payload = {
			title,
			startAt,
			endAt,
			allDay,
			taskId: taskId ?? null,
			color: color ?? null,
			icon: icon ?? null,
			notes,
		};

		if (drawerEvent) {
			updateMutation.mutate({ id: drawerEvent.id, ...payload });
		} else {
			createMutation.mutate(payload);
		}
	}

	return (
		<Drawer open onClose={closeDrawer} title={isEdit ? "Editar evento" : "Novo evento"}>
			<div className="flex flex-col gap-4">
				<label className="flex flex-col gap-1">
					<Text size="xs" tone="muted">
						Título
					</Text>
					<Input
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder={drawerEvent?.displayTitle ?? "Título do evento"}
						autoFocus
					/>
				</label>

				<div className="flex items-center justify-between">
					<Text size="sm">Dia inteiro</Text>
					<Switch checked={allDay} onCheckedChange={setAllDay} />
				</div>

				<div className="flex flex-col gap-2">
					<Text size="xs" tone="muted">
						Início
					</Text>
					<div className="flex gap-2">
						<Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
						{!allDay && (
							<Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
						)}
					</div>
				</div>

				<div className="flex flex-col gap-2">
					<Text size="xs" tone="muted">
						Fim
					</Text>
					<div className="flex gap-2">
						<Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
						{!allDay && (
							<Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
						)}
					</div>
				</div>

				<div className="flex flex-col gap-2">
					<Text size="xs" tone="muted">
						Cor
					</Text>
					<div className="grid grid-cols-6 gap-2">
						{projectColorOptions.map((option) => (
							<button
								key={option.value}
								type="button"
								title={option.label}
								onClick={() => setColor(option.value)}
								style={{ backgroundColor: option.value }}
								className={cn(
									"h-8 w-full rounded-md border-2 transition",
									color === option.value ? "border-foreground" : "border-transparent",
								)}
							/>
						))}
					</div>
				</div>

				<div className="flex items-center justify-between gap-2">
					<Text size="xs" tone="muted">
						Ícone
					</Text>
					<IconSelector value={icon} onChange={setIcon} className="h-9 w-full" showLabel />
				</div>

				<div className="flex flex-col gap-1">
					<Text size="xs" tone="muted">
						Linkar tarefa
					</Text>
					<CustomSelect
						items={taskItems}
						value={taskId ?? ""}
						onValueChange={(value) => setTaskId(value || undefined)}
						triggerClassName="border border-input"
						renderTrigger={() => (
							<span className="truncate text-sm">
								{selectedTask?.displayTitle ?? NO_TASK.displayTitle}
							</span>
						)}
						renderItem={(item) => <span className="truncate text-sm">{item.displayTitle}</span>}
					/>
				</div>

				<label className="flex flex-col gap-1">
					<Text size="xs" tone="muted">
						Notas
					</Text>
					<Textarea
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
						placeholder="Descrição livre"
					/>
				</label>

				<div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-4">
					{isEdit ? (
						<Button
							variant="ghost"
							className="text-destructive"
							onClick={() => setConfirmDelete(true)}
						>
							Excluir
						</Button>
					) : (
						<span />
					)}
					<Button onClick={handleSave} disabled={saving}>
						{saving ? "Salvando…" : "Salvar"}
					</Button>
				</div>
			</div>

			{drawerEvent && (
				<ConfirmDialog
					open={confirmDelete}
					onClose={() => setConfirmDelete(false)}
					onConfirm={() => removeMutation.mutate({ id: drawerEvent.id })}
					title="Excluir evento"
					description={`Excluir "${drawerEvent.displayTitle}"?`}
					confirmLabel="Excluir"
					variant="danger"
					loading={removeMutation.isPending}
				/>
			)}
		</Drawer>
	);
}
