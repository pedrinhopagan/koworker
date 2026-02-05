import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck } from "lucide-react";
import { useRef } from "react";
import { z } from "zod";

import {
	AgendaDndWrapper,
	DayDrawer,
	WeekCalendar,
	type WeekCalendarRef,
} from "@/components/agenda";
import { PageShell } from "@/components/layout/page-shell";
import { useProjectFocus } from "@/hooks";

const searchSchema = z.object({
	inicio: z.string().optional(),
	fim: z.string().optional(),
	projetoId: z.string().optional(),
	mostrar: z.enum(["agenda", "lista"]).optional(),
});

export const Route = createFileRoute("/_app/agenda/")({
	validateSearch: (search) => searchSchema.parse(search),
	component: AgendaPage,
});

function AgendaPage() {
	const { projetoId } = Route.useSearch();
	useProjectFocus({ preferredProjectId: projetoId ?? null });
	const calendarRef = useRef<WeekCalendarRef>(null);

	function handleTaskChange() {
		calendarRef.current?.refresh();
	}

	return (
		<PageShell
			title="Agenda"
			description="Arraste tarefas entre dias para reagendar"
			icon={CalendarCheck}
		>
			<AgendaDndWrapper onTasksChanged={handleTaskChange}>
				<div className="flex h-[calc(100vh-180px)] flex-col overflow-hidden rounded-lg border border-border bg-card">
					<WeekCalendar ref={calendarRef} />
				</div>
				<DayDrawer onTaskChange={handleTaskChange} />
			</AgendaDndWrapper>
		</PageShell>
	);
}
