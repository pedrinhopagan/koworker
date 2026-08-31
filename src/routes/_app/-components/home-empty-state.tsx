import { Link } from "@tanstack/react-router";
import { ArrowUpRight, FolderKanban, Plus, Target } from "lucide-react";

import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";

export function HomeEmptyState() {
	return (
		<section className="grid min-h-[28rem] border border-border bg-card shadow-xs md:grid-cols-12">
			<div className="flex flex-col justify-between border-b border-border p-6 md:col-span-7 md:border-b-0 md:border-r md:p-9">
				<div>
					<div className="flex items-center gap-2">
						<Target className="size-4 text-primary" aria-hidden />
						<Text size="xs" tone="muted" className="uppercase tracking-[0.16em]">
							Defina o foco operacional
						</Text>
					</div>
					<Title
						as="h1"
						className="mt-5 max-w-xl text-3xl leading-tight tracking-[-0.04em] sm:text-4xl"
					>
						A Home começa com um projeto em foco.
					</Title>
					<Text tone="muted" className="mt-4 max-w-lg leading-relaxed">
						Escolha um projeto existente ou crie um novo. Depois disso, tarefas, agents e sessões
						aparecem aqui em uma única fila de decisão.
					</Text>
				</div>
				<div className="mt-10 flex flex-wrap gap-2">
					<Button asChild>
						<Link to="/projetos/novo">
							<Plus className="size-4" /> Novo projeto
						</Link>
					</Button>
					<Button asChild variant="outline">
						<Link to="/projetos">
							<FolderKanban className="size-4" /> Ver projetos
						</Link>
					</Button>
				</div>
			</div>

			<div className="flex flex-col bg-muted/20 p-6 md:col-span-5 md:p-9">
				<Text size="xs" tone="muted" className="uppercase tracking-[0.16em]">
					Uma instrução
				</Text>
				<div className="my-auto py-8">
					<div className="flex size-10 items-center justify-center border border-border bg-card font-mono text-sm font-bold text-primary shadow-xs">
						01
					</div>
					<Title as="h2" className="mt-5 text-xl">
						Selecione o projeto na barra de foco.
					</Title>
					<Text size="sm" tone="muted" className="mt-2 leading-relaxed">
						O contexto será mantido entre tarefas, documentos e terminais.
					</Text>
				</div>
				<Link
					to="/projetos"
					className="flex items-center justify-between border-t border-border pt-4 text-sm font-semibold hover:text-primary"
				>
					Gerenciar foco <ArrowUpRight className="size-4" />
				</Link>
			</div>
		</section>
	);
}
