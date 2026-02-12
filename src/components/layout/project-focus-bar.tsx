import {
	Link,
	type LinkProps,
	type RegisteredRouter,
	useRouterState,
} from "@tanstack/react-router";
import { CheckCheckIcon, ChevronDownIcon, FolderKanbanIcon, Plus, Terminal } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import { type UseProjectFocusReturn, useProjectFocus } from "@/hooks";
import { LucideIcon } from "@/lib/lucide-icon";
import { isTauri } from "@/lib/tauri";
import { openProjectRoute, openProjectTerminal } from "@/lib/terminal";
import { cn } from "@/lib/utils";
import { useIsProjectTerminalOpen } from "@/stores/terminal-status";
import { TerminalShortcutMenu } from "./terminal-shortcut-menu";

const ALL_PROJECTS_ID = "__all_projects__";

type ProjectItem = {
	id: string;
	name: string;
	color: string | null;
};

type ProjectRouteActionsProps = {
	projectId: string;
	project: NonNullable<UseProjectFocusReturn["selectedProject"]>;
};

function ProjectRouteActions({ projectId, project }: ProjectRouteActionsProps) {
	const [isOpeningTerminal, setIsOpeningTerminal] = useState(false);
	const [isOpeningRoute, setIsOpeningRoute] = useState(false);
	const isTerminalOpen = useIsProjectTerminalOpen(projectId);

	async function handleTerminalClick() {
		setIsOpeningTerminal(true);
		try {
			await openProjectTerminal({
				id: projectId,
				name: project.name,
				mainRoute: project.mainRoute,
			});
		} finally {
			setIsOpeningTerminal(false);
		}
	}

	async function handleRouteClick(route: NonNullable<typeof project.routes>[number]) {
		setIsOpeningRoute(true);
		try {
			await openProjectRoute({
				projectId,
				projectName: project.name,
				route: {
					id: route.id,
					name: route.name,
					path: route.route,
					command: route.command,
				},
			});
		} finally {
			setIsOpeningRoute(false);
		}
	}

	return (
		<>
			{isTauri() && (
				<>
					<TerminalShortcutMenu
						projectId={projectId}
						project={{ id: projectId, name: project.name, mainRoute: project.mainRoute }}
						isTerminal
					>
						<Button
							variant="ghost"
							size="sm"
							onClick={handleTerminalClick}
							disabled={isOpeningTerminal}
							className={cn(
								"h-9 px-3 gap-2 transition-all",
								isTerminalOpen && "text-green-500 hover:text-green-400",
							)}
							title={isTerminalOpen ? "Focar terminal do projeto" : "Abrir terminal do projeto"}
						>
							<Terminal className={cn("size-4", isOpeningTerminal && "animate-pulse")} />
							<span className="text-xs hidden sm:inline">Terminal</span>
						</Button>
					</TerminalShortcutMenu>

					{project.routes
						?.sort((a, b) => a.displayOrder - b.displayOrder)
						.map((route) => (
							<TerminalShortcutMenu
								key={route.id}
								projectId={projectId}
								project={{ id: projectId, name: project.name, mainRoute: project.mainRoute }}
								route={{
									id: route.id,
									name: route.name,
									route: route.route,
									command: route.command,
								}}
							>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => handleRouteClick(route)}
									disabled={isOpeningRoute}
									className={cn("h-9 px-3 gap-2 transition-all")}
									title={
										route.command
											? `${route.name}: ${route.command}`
											: `Abrir terminal em ${route.name}`
									}
								>
									<LucideIcon
										name={route.icon ?? "FolderOpen"}
										className={cn("size-4", isOpeningRoute && "animate-pulse")}
									/>
									<span className="text-xs hidden sm:inline">{route.name}</span>
								</Button>
							</TerminalShortcutMenu>
						))}
				</>
			)}

			<Button
				variant="ghost"
				size="sm"
				asChild
				className="h-9 px-2 gap-1 text-muted-foreground hover:text-foreground transition-colors"
				title="Adicionar rota personalizada"
			>
				<Link to="/projetos/$projetoId" params={{ projetoId: projectId }}>
					<Plus className="size-3" />
					<span className="text-xs hidden sm:inline">Adicionar</span>
				</Link>
			</Button>
		</>
	);
}

const DISABLED_PATHS = new Set<LinkProps<RegisteredRouter>["to"]>([
	"/projetos/$projetoId",
	"/projetos/novo",
	"/tarefas/$taskId",
]);

export function ProjectFocusBar() {
	const routerState = useRouterState();

	const { projects, selectedProjectId, selectedProject, accent, loading, setSelectedProjectId } =
		useProjectFocus();

	const projectItems = useMemo<ProjectItem[]>(() => {
		return [
			{ id: ALL_PROJECTS_ID, name: "Todos os projetos", color: null },
			...projects.map((project) => ({
				id: project.id,
				name: project.name,
				color: project.color ?? null,
			})),
		];
	}, [projects]);

	const accentColor = accent?.color ?? null;
	const isEmpty = projectItems.length === 0;
	const label =
		selectedProjectId === undefined
			? "Todos os projetos"
			: (selectedProject?.name ??
				(loading ? "Carregando projetos..." : isEmpty ? "Nenhum projeto" : "Selecione um projeto"));

	function handleValueChange(id: string, _item: ProjectItem) {
		if (id === ALL_PROJECTS_ID) {
			setSelectedProjectId(undefined);
			return;
		}
		setSelectedProjectId(id);
	}

	const currentRoutePath = (routerState.matches.at(-1)?.fullPath ?? "/").replace(/\/$/, "");
	const disableChangeFocus = DISABLED_PATHS.has(currentRoutePath as any);

	return (
		<div className="flex items-center gap-3">
			<span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
				Projeto
			</span>

			<CustomSelect
				items={projectItems}
				value={selectedProjectId === undefined ? ALL_PROJECTS_ID : (selectedProjectId ?? undefined)}
				onValueChange={handleValueChange}
				variant="minimal"
				disabled={isEmpty || disableChangeFocus}
				loading={loading}
				triggerClassName={cn(
					"flex items-center gap-3 px-4 py-2 rounded-lg min-w-[220px] transition-all duration-200 border-2 bg-card/80 backdrop-blur",
					accentColor ? "shadow-sm hover:shadow-md" : "border-border",
				)}
				triggerStyle={
					accent
						? {
								background: `linear-gradient(135deg, ${accent.soft} 0%, ${accent.muted} 100%)`,
								borderColor: accent.border,
								boxShadow: `0 0 0 1px ${accent.border}, 0 10px 24px ${accent.glow}`,
							}
						: undefined
				}
				contentClassName="min-w-[220px]"
				renderTrigger={() => (
					<>
						{accentColor ? (
							<span
								className="size-3 rounded-full shrink-0"
								style={{
									backgroundColor: accentColor,
									boxShadow: `0 0 0 2px ${accent?.ring ?? accentColor}, 0 0 10px ${accent?.glow ?? accentColor}`,
								}}
							/>
						) : (
							<FolderKanbanIcon className="size-4 text-muted-foreground shrink-0" />
						)}
						<span
							className={cn(
								"flex-1 text-sm font-medium truncate text-left",
								accentColor ? "text-foreground" : "text-foreground",
							)}
						>
							{label}
						</span>
						<ChevronDownIcon
							className={cn(
								"size-4 shrink-0 transition-colors",
								accentColor ? "text-foreground" : "text-muted-foreground",
							)}
						/>
					</>
				)}
				renderItem={(project, isSelected) => (
					<div
						className={cn(
							"flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors",
							isSelected && "font-medium",
						)}
						style={isSelected ? { color: project.color ?? undefined } : undefined}
					>
						{project.color ? (
							<span
								className="size-2.5 rounded-full shrink-0"
								style={{ backgroundColor: project.color }}
							/>
						) : (
							<FolderKanbanIcon className="size-3.5 text-current shrink-0" />
						)}
						<span className={cn("flex-1 text-sm truncate")}>{project.name}</span>
						{isSelected && (
							<CheckCheckIcon
								className="size-4 shrink-0"
								style={{ color: project.color ?? undefined }}
							/>
						)}
					</div>
				)}
			/>

			{selectedProjectId && selectedProject && (
				<ProjectRouteActions projectId={selectedProjectId} project={selectedProject} />
			)}
		</div>
	);
}
