import { createFileRoute, Link } from "@tanstack/react-router";
import { tv } from "tailwind-variants";
import { z } from "zod";

import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageShell } from "@/routes/_app/-components/page-shell";

const searchSchema = z.object({
	q: z.string().optional(),
	status: z.enum(["ativos", "arquivados"]).optional(),
	ordem: z.enum(["recentes", "nome"]).optional(),
	projetoId: z.string().optional(),
});

export const Route = createFileRoute("/_app/projetos/")({
	validateSearch: (search) => searchSchema.parse(search),
	component: ProjetosPage,
});

const projetosMock = [
	{
		id: "workopilot",
		nome: "WorkOpilot",
		pasta: "/home/pedro/Documents/projects/workopilot",
		atualizado: "Atualizado há 6 dias",
		tarefas: 0,
	},
	{
		id: "dogama",
		nome: "Dogama",
		pasta: "/home/pedro/Documents/projects/dogama",
		atualizado: "Atualizado há 6 dias",
		tarefas: 0,
	},
	{
		id: "jupe",
		nome: "Jupe",
		pasta: "/home/pedro/Documents/projects/jupe",
		atualizado: "Atualizado há 6 dias",
		tarefas: 0,
	},
];

const projetoCard = tv({
	base: "rounded-md border border-border bg-card px-4 py-3 transition",
	variants: {
		ativo: {
			true: "border-primary/60 bg-muted/60",
			false: "hover:border-muted-foreground/40",
		},
	},
});

function ProjetosPage() {
	const { projetoId } = Route.useSearch();
	const selecionadoId = projetoId ?? projetosMock[0]?.id;
	const projetoSelecionado = projetosMock.find((projeto) => projeto.id === selecionadoId);

	return (
		<PageShell title="Projetos" description="Organize seus projetos e contextos">
			<div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
				<section className="space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<Title size="sm">Meus projetos</Title>
							<Text size="sm" tone="muted">
								{projetosMock.length} projetos cadastrados
							</Text>
						</div>
						<Button variant="secondary">Novo projeto</Button>
					</div>

					<div className="grid gap-3">
						{projetosMock.map((projeto) => (
							<Link
								key={projeto.id}
								to="/projetos"
								search={{ projetoId: projeto.id }}
								className={projetoCard({ ativo: projeto.id === selecionadoId })}
							>
								<div className="flex items-start gap-3">
									<div className="mt-1 size-9 rounded-md bg-muted" />
									<div className="flex-1">
										<Title size="sm" as="div">
											{projeto.nome}
										</Title>
										<Text size="sm" tone="muted">
											{projeto.pasta}
										</Text>
										<div className="mt-2 flex flex-wrap items-center gap-3">
											<Text size="xs" tone="muted">
												{projeto.tarefas === 0 ? "Sem tarefas" : `${projeto.tarefas} tarefas`}
											</Text>
											<Text size="xs" tone="muted">
												{projeto.atualizado}
											</Text>
										</div>
									</div>
									<div className="mt-1 size-2 rounded-full bg-primary/70" />
								</div>
							</Link>
						))}
					</div>
				</section>

				<section className="space-y-4">
					<Card>
						<CardHeader className="space-y-1">
							<Title size="sm">Criar projeto</Title>
							<Text size="sm" tone="muted">
								Preencha os dados principais
							</Text>
						</CardHeader>
						<CardContent>
							<form className="grid gap-4" onSubmit={(event) => event.preventDefault()}>
								<div className="grid gap-2">
									<Label htmlFor="nome-projeto">Nome do projeto</Label>
									<Input id="nome-projeto" placeholder="Ex: WorkOpilot" />
								</div>
								<div className="grid gap-2">
									<Label htmlFor="descricao-projeto">Descrição</Label>
									<Input id="descricao-projeto" placeholder="Resumo do projeto" />
								</div>
								<div className="grid gap-2">
									<Label htmlFor="pasta-projeto">Pasta base</Label>
									<Input id="pasta-projeto" placeholder="/home/usuario/projetos" />
								</div>
								<div className="flex flex-wrap gap-2">
									<Button type="submit">Salvar</Button>
									<Button type="button" variant="outline">
										Testar pasta
									</Button>
								</div>
							</form>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="space-y-1">
							<Title size="sm">Resumo do projeto</Title>
							<Text size="sm" tone="muted">
								{projetoSelecionado ? projetoSelecionado.nome : "Selecione um projeto"}
							</Text>
						</CardHeader>
						<CardContent className="space-y-3">
							<div className="grid grid-cols-2 gap-2">
								<ResumoItem label="Total" valor="56" />
								<ResumoItem label="Progresso" valor="75%" />
								<ResumoItem label="Pendentes" valor="14" />
								<ResumoItem label="Concluídas" valor="42" />
							</div>
							<div>
								<Text size="xs" tone="muted" className="mb-2">
									Progresso geral
								</Text>
								<div className="h-2 w-full rounded-full bg-muted">
									<div className="h-2 w-[75%] rounded-full bg-primary" />
								</div>
							</div>
							<div>
								<div className="mb-2 flex items-center justify-between">
									<Text size="xs" tone="muted">
										Tarefas urgentes
									</Text>
									<Text size="xs" tone="muted">
										Ver todas
									</Text>
								</div>
								<div className="rounded-md border border-border bg-muted/40 px-3 py-2">
									<div className="flex items-center justify-between">
										<Text size="sm">Unificar lista de tarefas</Text>
										<Text size="xs" tone="warning" className="rounded-sm bg-warning/20 px-2 py-0.5">
											P1
										</Text>
									</div>
									<Text size="xs" tone="muted">
										Aguardando revisão
									</Text>
								</div>
							</div>
						</CardContent>
					</Card>
				</section>
			</div>
		</PageShell>
	);
}

type ResumoItemProps = {
	label: string;
	valor: string;
};

function ResumoItem({ label, valor }: ResumoItemProps) {
	return (
		<div className="rounded-md border border-border bg-muted/30 px-3 py-2">
			<Text size="xs" tone="muted">
				{label}
			</Text>
			<Title size="sm" as="div">
				{valor}
			</Title>
		</div>
	);
}
