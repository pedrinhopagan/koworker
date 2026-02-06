import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck } from "lucide-react";
import { useRef, useState } from "react";
import { z } from "zod";

import {
	AgendaDndWrapper,
	AgendaSidebar,
	DayDrawer,
	MonthCalendar,
	type MonthCalendarRef,
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
	const [viewMode, setViewMode] = useState<"semana" | "mes">("semana");
	const weekCalendarRef = useRef<WeekCalendarRef>(null);
	const monthCalendarRef = useRef<MonthCalendarRef>(null);

	function handleTaskChange() {
		weekCalendarRef.current?.refresh();
		monthCalendarRef.current?.refresh();
	}

	return (
		<AgendaDndWrapper onTasksChanged={handleTaskChange}>
			<PageShell
				title="Agenda"
				description="Planeje tarefas por semana ou mês e arraste para reagendar"
				icon={CalendarCheck}
				variant="grid"
				contentClassName="gap-0 md:grid-cols-[320px_minmax(0,1fr)]"
				headerClassName="mb-0"
			>
				<AgendaSidebar />

				<div className="flex min-h-0 min-w-0 flex-1 flex-col">
					<div className="flex items-center gap-2 border-b border-border px-4 py-3">
						<button
							type="button"
							onClick={() => setViewMode("semana")}
							className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
								viewMode === "semana"
									? "bg-primary text-primary-foreground"
									: "bg-muted text-muted-foreground hover:text-foreground"
							}`}
						>
							Semana
						</button>
						<button
							type="button"
							onClick={() => setViewMode("mes")}
							className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
								viewMode === "mes"
									? "bg-primary text-primary-foreground"
									: "bg-muted text-muted-foreground hover:text-foreground"
							}`}
						>
							Mês
						</button>
					</div>

					<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
						{viewMode === "semana" && <WeekCalendar ref={weekCalendarRef} />}
						{viewMode === "mes" && <MonthCalendar ref={monthCalendarRef} />}
					</div>
				</div>
			</PageShell>
			<DayDrawer onTaskChange={handleTaskChange} />
		</AgendaDndWrapper>
	);
}
