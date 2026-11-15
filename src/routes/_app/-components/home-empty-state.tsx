import { Link } from "@tanstack/react-router";
import { Crosshair, Plus, Target } from "lucide-react";

import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { useProjectFocus } from "@/hooks";
import { useProjectSelectDialogStore } from "@/hooks/use-project-select-dialog";

export function HomeEmptyState() {
	const { projects } = useProjectFocus();
	const openProjectDialog = useProjectSelectDialogStore((s) => s.openDialog);
	const hasProjects = projects.length > 0;

	return (
		<section className="animate-stagger-fade-in border border-border bg-card p-6 shadow-xs sm:p-9">
			<div className="flex items-center gap-2">
				<Target className="size-4 text-muted-foreground" aria-hidden />
				<Text size="xs" tone="muted" className="uppercase tracking-[0.16em]">
					Defina o foco operacional
				</Text>
			</div>
			<Title
				as="h1"
				className="mt-5 max-w-xl text-4xl leading-[0.95] tracking-[-0.045em] sm:text-5xl"
			>
				A Home começa com um projeto em foco.
			</Title>
			<Text tone="muted" className="mt-4 max-w-lg">
				Escolha um projeto existente ou crie um novo. Depois disso, agents, sessões e o progresso
				das tarefas aparecem aqui.
			</Text>
			<div className="mt-8 flex flex-wrap gap-2">
				{hasProjects && (
					<Button onClick={openProjectDialog}>
						<Crosshair className="size-4" /> Escolher projeto
					</Button>
				)}
				<Button asChild variant={hasProjects ? "outline" : "default"}>
					<Link to="/projetos/novo">
						<Plus className="size-4" /> Novo projeto
					</Link>
				</Button>
			</div>
		</section>
	);
}
