import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { Text, Title } from "@/components/typography";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageShell } from "@/routes/_app/-components/page-shell";

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
	return (
		<PageShell title="Agenda" description="Planeje entregas e prazos">
			<div className="grid gap-4 md:grid-cols-[280px_1fr]">
				<Card>
					<CardHeader className="space-y-1">
						<Title size="sm">Filtros</Title>
						<Text size="sm" tone="muted">
							Datas, projetos e visão
						</Text>
					</CardHeader>
					<CardContent>
						<Text size="sm" tone="muted">
							A navegação permanece tipada via URL.
						</Text>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="space-y-1">
						<Title size="sm">Visão calendário</Title>
						<Text size="sm" tone="muted">
							Conteúdo em construção
						</Text>
					</CardHeader>
					<CardContent>
						<Text size="sm" tone="muted">
							Aqui entra o calendário com tarefas distribuídas.
						</Text>
					</CardContent>
				</Card>
			</div>
		</PageShell>
	);
}
