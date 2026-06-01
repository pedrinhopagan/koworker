import {
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	PointerSensor,
	rectIntersection,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { Text } from "@/components/typography";
import type { AgendaEvent } from "@/types/agenda";
import type { TaskWithMeta } from "@/types/tasks";

const DATE_TIME_FORMAT = "YYYY-MM-DDTHH:mm";

type ActiveItem = { type: "task"; task: TaskWithMeta } | { type: "event"; event: AgendaEvent };

function invalidateAgenda(queryClient: ReturnType<typeof useQueryClient>) {
	queryClient.invalidateQueries({
		predicate: (q) => {
			const root = Array.isArray(q.queryKey?.[0]) ? q.queryKey[0][0] : null;
			return root === "events" || root === "tasks";
		},
	});
}

// Wrapper de DnD da agenda: arrastar uma tarefa do backlog para um dia cria um event all-day
// ligado a ela; arrastar um event para outro dia o desloca preservando horário/duração. As
// mutations já existentes (events.create/update) + invalidação cuidam do estado — sem cirurgia
// de cache otimista (o realtime já invalida ambos os canais).
export function AgendaDndWrapper({ children }: { children: ReactNode }) {
	const queryClient = useQueryClient();
	const [active, setActive] = useState<ActiveItem | null>(null);

	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

	const createMutation = useMutation({
		...orpc.events.create.mutationOptions(),
		onSuccess: () => invalidateAgenda(queryClient),
		onError: (error) => toast.error(error instanceof Error ? error.message : "Erro ao agendar"),
	});
	const updateMutation = useMutation({
		...orpc.events.update.mutationOptions(),
		onSuccess: () => invalidateAgenda(queryClient),
		onError: (error) => toast.error(error instanceof Error ? error.message : "Erro ao mover"),
	});

	function handleDragStart(event: DragStartEvent) {
		const data = event.active.data.current as ActiveItem | undefined;
		if (data) {
			setActive(data);
		}
	}

	function handleDragEnd(event: DragEndEvent) {
		setActive(null);

		const overData = event.over?.data.current as { type: string; date: string } | undefined;
		if (overData?.type !== "day") {
			return;
		}

		const date = overData.date;
		const data = event.active.data.current as ActiveItem | undefined;
		if (!data) {
			return;
		}

		if (data.type === "task") {
			// Soltar no dia = all-day; o router normaliza o end_at (dia seguinte, exclusivo).
			createMutation.mutate({ startAt: `${date}T00:00`, allDay: true, taskId: data.task.id });
			return;
		}

		const { event: dragged } = data;
		if (dragged.startAt.slice(0, 10) === date) {
			return;
		}

		// Move preservando horário/duração: desloca pelo delta de dias. Para all-day, o handler
		// espera endAt = ÚLTIMO dia INCLUSIVO (recompõe o exclusivo somando 1 dia) — por isso o
		// -1 antes de deslocar; senão o evento cresceria um dia a cada move. Timed usa o instante.
		const deltaDays = dayjs(date).diff(dayjs(dragged.startAt.slice(0, 10)), "day");
		const shift = (value: string) =>
			dayjs(value, DATE_TIME_FORMAT).add(deltaDays, "day").format(DATE_TIME_FORMAT);
		const endSource = dragged.allDay
			? dayjs(dragged.endAt, DATE_TIME_FORMAT).subtract(1, "day").format(DATE_TIME_FORMAT)
			: dragged.endAt;

		updateMutation.mutate({
			id: dragged.id,
			startAt: shift(dragged.startAt),
			endAt: shift(endSource),
			allDay: dragged.allDay,
		});
	}

	return (
		<DndContext
			sensors={sensors}
			collisionDetection={rectIntersection}
			onDragStart={handleDragStart}
			onDragEnd={handleDragEnd}
			onDragCancel={() => setActive(null)}
		>
			{children}

			<DragOverlay>
				{active && (
					<div className="max-w-[220px] border border-border bg-card px-2 py-1 shadow-xl">
						<Text as="span" size="sm" className="truncate">
							{active.type === "task" ? active.task.displayTitle : active.event.displayTitle}
						</Text>
					</div>
				)}
			</DragOverlay>
		</DndContext>
	);
}
