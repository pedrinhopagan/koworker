import { Link } from "@tanstack/react-router";
import { Bot, Command, Plus } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { type SortableItemRenderProps, SortableList } from "@/components/ui/sortable-list";
import { isProjectCliRoute } from "@/constants/projects";
import { useCapabilities } from "@/hooks/use-capabilities";
import type { ProjectDetail } from "../-utils/use-projects-data";
import { ProjectRouteShortcutItem } from "./project-route-shortcut-item";

type Project = NonNullable<ProjectDetail>;
type ProjectRoute = Project["routes"][number];

type ProjectLaunchpadProps = {
	project: Project;
	onReorder: (orderedIds: string[]) => void;
};

export function ProjectLaunchpad({ project, onReorder }: ProjectLaunchpadProps) {
	const { canOpenTerminal } = useCapabilities();
	const showTerminal = canOpenTerminal && !project.hideTerminal;
	const sorted = useMemo(
		() => [...project.routes].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
		[project.routes],
	);
	const [ordered, setOrdered] = useState<ProjectRoute[]>(sorted);

	useEffect(() => {
		setOrdered((previous) => {
			if (
				previous.length === sorted.length &&
				previous.every((route, index) => route.id === sorted[index]?.id)
			) {
				return previous;
			}
			return sorted;
		});
	}, [sorted]);

	const cliRoutes = ordered.filter(isProjectCliRoute);
	const commandRoutes = ordered.filter((route) => !isProjectCliRoute(route));
	const shortcutCount = ordered.length + (showTerminal ? 1 : 0);
	const projectInfo = { id: project.id, name: project.name, mainRoute: project.mainRoute };

	function renderItem(route: ProjectRoute, props: SortableItemRenderProps) {
		return <ProjectRouteShortcutItem project={projectInfo} route={route} sortable={props} />;
	}

	function reorderGroup(group: "cli" | "command", items: ProjectRoute[]) {
		const next = group === "cli" ? [...items, ...commandRoutes] : [...cliRoutes, ...items];
		setOrdered(next);
		onReorder(next.map((item) => item.id));
	}

	return (
		<section className="flex min-w-0 flex-col lg:h-full">
			<div className="flex items-end justify-between gap-3 border-b border-border pb-4">
				<div>
					<Text size="xs" tone="faint" className="font-mono uppercase tracking-[0.14em]">
						Ações
					</Text>
					<Title as="h2" size="lg" className="mt-1">
						Launchpad
					</Title>
					<Text size="xs" tone="muted" className="mt-1">
						{shortcutCount} {shortcutCount === 1 ? "ação disponível" : "ações disponíveis"}
					</Text>
				</div>
				<Button variant="outline" size="sm" asChild>
					<Link to="/projetos/$projetoId" params={{ projetoId: project.id }}>
						<Plus className="size-3.5" /> Adicionar
					</Link>
				</Button>
			</div>

			<div className="mt-4 space-y-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-2 lg:[scrollbar-gutter:stable]">
				{showTerminal && <ProjectRouteShortcutItem project={projectInfo} isTerminal />}
				{cliRoutes.length > 0 && (
					<ShortcutGroup title="CLIs" count={cliRoutes.length} icon={<Bot className="size-4" />}>
						<SortableList
							items={cliRoutes}
							onReorder={(items) => reorderGroup("cli", items)}
							renderItem={renderItem}
							className="gap-2"
						/>
					</ShortcutGroup>
				)}
				{commandRoutes.length > 0 && (
					<ShortcutGroup
						title="Comandos"
						count={commandRoutes.length}
						icon={<Command className="size-4" />}
					>
						<SortableList
							items={commandRoutes}
							onReorder={(items) => reorderGroup("command", items)}
							renderItem={renderItem}
							className="gap-2"
						/>
					</ShortcutGroup>
				)}
				{shortcutCount === 0 && (
					<div className="border border-dashed border-border bg-muted/15 px-6 py-10 text-center">
						<Command className="mx-auto size-6 text-muted-foreground" />
						<Title as="div" size="sm" className="mt-3">
							Launchpad vazio
						</Title>
						<Text size="xs" tone="muted" className="mx-auto mt-1 max-w-64">
							Adicione uma CLI, um comando ou habilite o terminal deste projeto.
						</Text>
					</div>
				)}
			</div>
			<Text size="xs" tone="faint" className="mt-3 hidden lg:block">
				Clique para abrir · botão direito para opções · arraste pelo puxador
			</Text>
		</section>
	);
}

function ShortcutGroup({
	title,
	count,
	icon,
	children,
}: {
	title: string;
	count: number;
	icon: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className="space-y-2">
			<div className="flex items-center gap-2 text-muted-foreground">
				{icon}
				<Text as="div" size="xs" tone="muted" className="font-semibold uppercase tracking-[0.12em]">
					{title}
				</Text>
				<span className="font-mono text-[10px]">{count}</span>
			</div>
			{children}
		</div>
	);
}
