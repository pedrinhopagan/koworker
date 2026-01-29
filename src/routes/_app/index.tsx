import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { Text, Title } from "@/components/typography";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageShell } from "@/routes/_app/-components/page-shell";

const searchSchema = z.object({
	foco: z.enum(["semana", "mes"]).optional(),
	q: z.string().optional(),
});

export const Route = createFileRoute("/_app/")({
	validateSearch: (search) => searchSchema.parse(search),
	component: HomePage,
});

function HomePage() {
	const { foco } = Route.useSearch();
	const periodoLabel = foco === "mes" ? "Mês atual" : "Semana atual";

	return (
		<PageShell title="Home" description="Visão geral das suas atividades">
			<div className="grid gap-4 md:grid-cols-2">
				<Card>
					<CardHeader className="space-y-1">
						<Title size="sm">Resumo</Title>
						<Text size="sm" tone="muted">
							{periodoLabel}
						</Text>
					</CardHeader>
					<CardContent className="space-y-3">
						<Text>Conteúdo inicial em construção.</Text>
						<div className="flex flex-wrap gap-2">
							<Text as="span" size="xs" tone="muted" className="rounded-md bg-muted px-2 py-1">
								Pendentes
							</Text>
							<Text as="span" size="xs" tone="muted" className="rounded-md bg-muted px-2 py-1">
								Em execução
							</Text>
							<Text as="span" size="xs" tone="muted" className="rounded-md bg-muted px-2 py-1">
								Revisão
							</Text>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="space-y-1">
						<Title size="sm">Atalhos</Title>
						<Text size="sm" tone="muted">
							Acesso rápido às ações
						</Text>
					</CardHeader>
					<CardContent className="space-y-3">
						<Text size="sm" tone="muted">
							Conecte aqui as ações principais da sua rotina.
						</Text>
						<div className="flex flex-wrap gap-2">
							<Text as="span" size="xs" tone="muted" className="rounded-md bg-muted px-2 py-1">
								Criar tarefa
							</Text>
							<Text as="span" size="xs" tone="muted" className="rounded-md bg-muted px-2 py-1">
								Revisões
							</Text>
							<Text as="span" size="xs" tone="muted" className="rounded-md bg-muted px-2 py-1">
								Agenda
							</Text>
						</div>
					</CardContent>
				</Card>
			</div>
		</PageShell>
	);
}
