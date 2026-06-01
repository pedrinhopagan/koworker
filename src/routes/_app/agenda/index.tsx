import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAgendaStore } from "@/stores/agenda";
import { AgendaDndWrapper } from "./-components/agenda-dnd-wrapper";
import { AgendaSidebar } from "./-components/agenda-sidebar";
import { EventDrawer } from "./-components/event-drawer";
import { MonthCalendar } from "./-components/month-calendar";
import { WeekCalendar } from "./-components/week-calendar";
import { useAgendaRealtime } from "./-utils/use-agenda-realtime";

export const Route = createFileRoute("/_app/agenda/")({
	component: AgendaPage,
});

function AgendaPage() {
	useAgendaRealtime();
	const view = useAgendaStore((s) => s.view);
	const setView = useAgendaStore((s) => s.setView);
	const drawerOpen = useAgendaStore((s) => s.drawerOpen);
	const drawerEvent = useAgendaStore((s) => s.drawerEvent);
	const drawerDate = useAgendaStore((s) => s.drawerDate);

	return (
		<PageShell
			title="Agenda"
			description="Planeje eventos e tarefas no tempo"
			icon={CalendarCheck}
			variant="grid"
			contentClassName="md:grid-cols-[280px_minmax(0,1fr)]"
		>
			<AgendaDndWrapper>
				<AgendaSidebar />

				<div className="flex min-h-0 flex-col">
					<div className="mb-3 flex items-center gap-1">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setView("semana")}
							className={cn(view === "semana" && "bg-secondary text-foreground")}
						>
							Semana
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setView("mes")}
							className={cn(view === "mes" && "bg-secondary text-foreground")}
						>
							Mês
						</Button>
					</div>

					{view === "semana" ? <WeekCalendar /> : <MonthCalendar />}
				</div>
			</AgendaDndWrapper>

			{drawerOpen && <EventDrawer key={drawerEvent?.id ?? drawerDate ?? "new"} />}
		</PageShell>
	);
}
