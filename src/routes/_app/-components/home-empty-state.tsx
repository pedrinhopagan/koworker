import { Link } from "@tanstack/react-router";
import { ArrowUpRight, FolderKanban, Plus, Target } from "lucide-react";

import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HOME_DOT_GRID } from "./home-masthead";

const PIXELS = [
	0.15, 0.35, 0.15, 0.7, 0.15, 0.35, 0.15, 0.35, 1, 0.35, 0.15, 0.7, 0.15, 0.7, 0.35, 0.7, 1, 0.7,
	0.15, 0.35, 1, 0.35, 0.15, 0.35, 0.15,
];

export function HomeEmptyState() {
	return (
		<section className="relative grid min-h-[28rem] overflow-hidden border border-border bg-card shadow-xs md:grid-cols-12">
			<div
				aria-hidden
				className={cn(
					"pointer-events-none absolute inset-0 [mask-image:linear-gradient(135deg,black,transparent_55%)]",
					HOME_DOT_GRID,
				)}
			/>
			<div className="animate-stagger-fade-in relative flex flex-col justify-between border-b border-border p-6 md:col-span-7 md:border-b-0 md:border-r md:p-9">
				<div>
					<div className="flex items-center gap-2">
						<Target className="size-4 text-primary" aria-hidden />
						<Text size="xs" tone="muted" className="uppercase tracking-[0.16em]">
							Defina o foco operacional
						</Text>
					</div>
					<Title
						as="h1"
						className="mt-5 max-w-xl text-4xl leading-[0.95] tracking-[-0.045em] sm:text-6xl"
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

			<div className="animate-stagger-fade-in relative flex flex-col bg-muted/20 p-6 [animation-delay:120ms] md:col-span-5 md:p-9">
				<Text size="xs" tone="muted" className="uppercase tracking-[0.16em]">
					Uma instrução
				</Text>
				<div className="my-auto py-8">
					<div aria-hidden className="grid size-12 grid-cols-5 grid-rows-5 gap-0.5 text-primary">
						{PIXELS.map((opacity, index) => (
							<span
								key={index}
								className="animate-stagger-fade-in bg-current"
								style={{ opacity, animationDelay: `${250 + index * 25}ms` }}
							/>
						))}
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
