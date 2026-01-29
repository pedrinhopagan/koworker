import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { Text, Title } from "@/components/typography";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageShell } from "@/routes/_app/-components/page-shell";

const searchSchema = z.object({
	q: z.string().optional(),
	projetoId: z.string().optional(),
	categoriaId: z.string().optional(),
	prioridadeId: z.string().optional(),
	status: z.enum(["pendente", "execucao", "executado"]).optional(),
	pagina: z.coerce.number().int().min(1).optional(),
});

export const Route = createFileRoute("/_app/tarefas/")({
	validateSearch: (search) => searchSchema.parse(search),
	component: TarefasPage,
});

function TarefasPage() {
	return (
		<PageShell title="Tarefas" description="Visão completa das tarefas">
			<div className="grid gap-4">
				<Card>
					<CardHeader className="space-y-1">
						<Title size="sm">Filtros</Title>
						<Text size="sm" tone="muted">
							Pesquisa, status e prioridade
						</Text>
					</CardHeader>
					<CardContent>
						<Text size="sm" tone="muted">
							Tudo salvo na URL para compartilhar.
						</Text>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="space-y-1">
						<Title size="sm">Lista de tarefas</Title>
						<Text size="sm" tone="muted">
							Conteúdo em construção
						</Text>
					</CardHeader>
					<CardContent>
						<Text size="sm" tone="muted">
							Aqui entra a lista com estados e critérios.
						</Text>
					</CardContent>
				</Card>
			</div>
		</PageShell>
	);
}
