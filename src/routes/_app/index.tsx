import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, LayoutDashboardIcon } from "lucide-react";
import { useMemo } from "react";
import { orpc } from "@/client";
import { PageShell } from "@/components/layout/page-shell";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { useSelectedProjectStore } from "@/stores/selected-project";
import { HomeProjectShowcase } from "./-components/home-project-showcase";
import { useCreateTask } from "./tarefas/-utils/use-create-task";

export const Route = createFileRoute("/_app/")({
	component: HomePage,
});

function HomePage() {
	const selectedProjectId = useSelectedProjectStore((s) => s.selectedProjectId);

	const projectsQuery = useQuery(orpc.projects.list.queryOptions());
	const resolvedProjectId = useMemo(() => {
		if (!selectedProjectId) return null;
		const hasProjectSelected = (projectsQuery.data ?? []).some(
			(project) => project.id === selectedProjectId,
		);
		if (!hasProjectSelected) return null;
		return selectedProjectId;
	}, [projectsQuery.data, selectedProjectId]);

	const projectQuery = useQuery({
		...orpc.projects.getById.queryOptions({
			input: { id: resolvedProjectId ?? "" },
		}),
		enabled: Boolean(resolvedProjectId),
	});

	const { createTask, loading: creatingTask } = useCreateTask(() => {
		void projectQuery.refetch();
	});

	if (selectedProjectId && projectsQuery.isLoading) {
		return (
			<PageShell
				title="Home"
				description="Preparando o painel do projeto em foco"
				icon={LayoutDashboardIcon}
			>
				<div className="mx-auto flex h-full w-full max-w-5xl items-center justify-center px-4 pb-8">
					<Text tone="muted">Carregando projeto em foco...</Text>
				</div>
			</PageShell>
		);
	}

	if (!resolvedProjectId) {
		return (
			<PageShell
				title="Home"
				description="Selecione o foco do dia para ver o painel"
				icon={LayoutDashboardIcon}
			>
				<div className="mx-auto flex h-full w-full max-w-5xl items-center justify-center px-4 pb-8">
					<div className="w-full border border-dashed border-border/60 bg-card/60 px-8 py-14 text-center backdrop-blur">
						<Title as="h1" className="text-3xl font-black tracking-[0.2em] md:text-6xl">
							Crie um projeto
						</Title>
						<Text className="mx-auto mt-3 max-w-xl text-muted-foreground">
							Selecione um projeto na barra de foco ou crie um novo para liberar a vitrine da Home.
						</Text>
						<div className="mt-8 flex items-center justify-center">
							<Button asChild>
								<Link to="/projetos/novo">
									Novo projeto
									<ArrowUpRight className="size-4" />
								</Link>
							</Button>
						</div>
					</div>
				</div>
			</PageShell>
		);
	}

	if (projectQuery.isLoading) {
		return (
			<PageShell
				title="Home"
				description="Preparando o painel do projeto em foco"
				icon={LayoutDashboardIcon}
			>
				<div className="mx-auto flex h-full w-full max-w-5xl items-center justify-center px-4 pb-8">
					<Text tone="muted">Carregando projeto em foco...</Text>
				</div>
			</PageShell>
		);
	}

	const project = projectQuery.data;

	if (!project) {
		return (
			<PageShell
				title="Home"
				description="Projeto em foco não encontrado"
				icon={LayoutDashboardIcon}
			>
				<div className="mx-auto flex h-full w-full max-w-5xl items-center justify-center px-4 pb-8">
					<Text tone="muted">Crie um projeto</Text>
				</div>
			</PageShell>
		);
	}

	return (
		<PageShell
			title="Home"
			description="Vitrine visual do projeto selecionado"
			icon={LayoutDashboardIcon}
		>
			<HomeProjectShowcase
				project={project}
				onCreateTask={createTask}
				creatingTask={creatingTask}
			/>
		</PageShell>
	);
}
