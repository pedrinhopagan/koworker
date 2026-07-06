import { Terminal } from "lucide-react";
import { useState } from "react";

import { TerminalShortcutMenu } from "@/components/layout/terminal-shortcut-menu";
import { type SortableItemRenderProps, DragHandle } from "@/components/ui/sortable-list";
import { useCapabilities } from "@/hooks/use-capabilities";
import { LucideIcon } from "@/lib/lucide-icon";
import { openProjectRoute, openProjectTerminal } from "@/lib/terminal";
import { cn } from "@/lib/utils";
import { useIsProjectTerminalOpen } from "@/stores/terminal-status";

type ProjectRoute = {
	id: string;
	name: string;
	route: string;
	command?: string | null;
	icon?: string | null;
};

type ProjectInfo = {
	id: string;
	name: string;
	mainRoute: string;
};

type ProjectRouteShortcutItemProps = {
	project: ProjectInfo;
	route?: ProjectRoute;
	isTerminal?: boolean;
	sortable?: SortableItemRenderProps;
};

export function ProjectRouteShortcutItem({
	project,
	route,
	isTerminal,
	sortable,
}: ProjectRouteShortcutItemProps) {
	const [isOpening, setIsOpening] = useState(false);
	const { canOpenTerminal } = useCapabilities();
	const isTerminalOpen = useIsProjectTerminalOpen(project.id);

	if (isTerminal && !canOpenTerminal) {
		return null;
	}

	async function handleClick() {
		setIsOpening(true);
		try {
			if (isTerminal) {
				await openProjectTerminal({
					id: project.id,
					name: project.name,
					mainRoute: project.mainRoute,
				});
				return;
			}

			if (!route) {
				return;
			}

			await openProjectRoute({
				projectId: project.id,
				projectName: project.name,
				route: {
					id: route.id,
					name: route.name,
					path: route.route,
					command: route.command ?? undefined,
				},
			});
		} finally {
			setIsOpening(false);
		}
	}

	const label = isTerminal ? "Terminal" : (route?.name ?? "Atalho");
	const title = isTerminal
		? isTerminalOpen
			? "Focar terminal do projeto"
			: "Abrir terminal do projeto"
		: route?.command
			? `${route.name}: ${route.command}`
			: `Abrir terminal em ${route?.name ?? ""}`;

	const content = (
		<button
			type="button"
			onClick={handleClick}
			disabled={isOpening}
			title={title}
			className={cn(
				"flex w-full min-w-0 items-center gap-2.5 px-2 py-2 text-left transition-colors",
				isTerminal && isTerminalOpen && "text-green-500 hover:text-green-400",
			)}
		>
			{isTerminal ? (
				<Terminal className={cn("size-4 shrink-0", isOpening && "animate-pulse")} />
			) : (
				<LucideIcon
					name={route?.icon ?? "FolderOpen"}
					className={cn("size-4 shrink-0 text-muted-foreground", isOpening && "animate-pulse")}
				/>
			)}
			<span className="shrink-0 text-sm font-medium">{label}</span>
			{route?.command ? (
				<span className="ml-auto truncate font-mono text-xs text-muted-foreground">
					{route.command}
				</span>
			) : null}
		</button>
	);

	const menuRoute = route
		? {
				id: route.id,
				name: route.name,
				route: route.route,
				command: route.command ?? undefined,
			}
		: undefined;

	return (
		<div
			className={cn(
				"flex items-stretch border border-border bg-card transition-colors hover:bg-accent/50",
				sortable?.isDragging && "opacity-60",
			)}
		>
			{sortable ? (
				<div className="flex items-center px-1" onClick={(e) => e.stopPropagation()}>
					<DragHandle
						attributes={sortable.dragHandleProps.attributes}
						listeners={sortable.dragHandleProps.listeners}
					/>
				</div>
			) : (
				// Sem reorder (Terminal): espaçador da largura da coluna do handle pra alinhar o ícone
				// com os atalhos arrastáveis.
				<div className="w-8 shrink-0" aria-hidden />
			)}

			<TerminalShortcutMenu
				projectId={project.id}
				project={{ id: project.id, name: project.name, mainRoute: project.mainRoute }}
				route={menuRoute}
				isTerminal={isTerminal}
				className="min-w-0 flex-1"
			>
				{content}
			</TerminalShortcutMenu>
		</div>
	);
}
