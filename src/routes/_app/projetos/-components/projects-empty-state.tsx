import { Link } from "@tanstack/react-router";
import { ArrowRight, Command, FileText, FolderKanban, Plus, Terminal } from "lucide-react";

import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";

export function ProjectsEmptyState() {
	return (
		<section className="grid min-h-[26rem] overflow-hidden border border-border bg-card/30 shadow-xs md:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)]">
			<div className="flex flex-col justify-center px-6 py-10 sm:px-10 md:py-14">
				<div className="flex size-12 items-center justify-center border border-border bg-muted/40">
					<FolderKanban className="size-6 text-primary" />
				</div>
				<Text size="xs" tone="faint" className="mt-7 font-mono uppercase tracking-[0.16em]">
					Bancada vazia
				</Text>
				<Title size="xl" className="mt-2 max-w-xl text-3xl leading-tight">
					Conecte seu primeiro workspace.
				</Title>
				<Text size="sm" tone="muted" className="mt-3 max-w-lg leading-relaxed">
					Cadastre uma pasta para reunir terminais, CLIs, comandos e documentos de contexto em uma
					única bancada.
				</Text>
				<Button size="lg" asChild className="mt-7 self-start">
					<Link to="/projetos/novo">
						<Plus className="size-4" /> Criar primeiro projeto <ArrowRight className="size-4" />
					</Link>
				</Button>
			</div>
			<div className="border-t border-border bg-muted/20 p-5 md:border-l md:border-t-0 md:p-7">
				<Text size="xs" tone="faint" className="font-mono uppercase tracking-[0.14em]">
					O que entra na bancada
				</Text>
				<div className="mt-5 divide-y divide-border border-y border-border">
					<EmptyFeature icon={Terminal} label="Terminal do projeto" index="01" />
					<EmptyFeature icon={Command} label="CLIs e comandos rápidos" index="02" />
					<EmptyFeature icon={FileText} label="Documentos de contexto" index="03" />
				</div>
			</div>
		</section>
	);
}

function EmptyFeature({
	icon: Icon,
	label,
	index,
}: {
	icon: typeof Terminal;
	label: string;
	index: string;
}) {
	return (
		<div className="flex items-center gap-3 py-4">
			<Text as="span" size="xs" tone="faint" className="font-mono">
				{index}
			</Text>
			<Icon className="size-4 text-muted-foreground" />
			<Text as="span" size="sm" className="font-semibold">
				{label}
			</Text>
		</div>
	);
}
