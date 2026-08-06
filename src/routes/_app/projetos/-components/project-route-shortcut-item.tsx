import { ArrowUpRight, Terminal } from "lucide-react";
import { useState } from "react";

import { TerminalShortcutMenu } from "@/components/layout/terminal-shortcut-menu";
import { Text } from "@/components/typography";
import { type SortableItemRenderProps, DragHandle } from "@/components/ui/sortable-list";
import { resolveProjectRouteIcon } from "@/constants/projects";
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
				route: { id: route.id, name: route.name },
			});
		} finally {
			setIsOpening(false);
		}
	}

	const label = isTerminal ? "Terminal do projeto" : (route?.name ?? "Atalho");
	const ariaLabel = isTerminal
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
			aria-label={ariaLabel}
			className={cn(
				"group flex min-h-16 w-full min-w-0 cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-wait",
				isTerminal && isTerminalOpen && "text-green-500 hover:text-green-400",
			)}
		>
			<div className="flex size-9 shrink-0 items-center justify-center border border-border bg-muted/40 transition-colors group-hover:bg-background">
				{isTerminal ? (
					<Terminal className={cn("size-4", isOpening && "animate-pulse")} />
				) : (
					<LucideIcon
						name={route ? resolveProjectRouteIcon(route) : "FolderOpen"}
						className={cn("size-4 text-foreground", isOpening && "animate-pulse")}
					/>
				)}
			</div>
			<div className="min-w-0 flex-1">
				<Text as="div" size="sm" className="truncate font-semibold">
					{label}
				</Text>
				<Text
					size="xs"
					tone="muted"
					className="mt-0.5 block overflow-hidden text-ellipsis whitespace-nowrap font-mono"
				>
					{isTerminal ? project.mainRoute : (route?.command ?? route?.route)}
				</Text>
			</div>
			<ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
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
				"flex min-w-0 cursor-pointer items-stretch border border-border bg-card transition-colors hover:border-foreground/25 hover:bg-accent/50",
				sortable?.isDragging && "opacity-60",
			)}
		>
			{sortable ? (
				<div
					className="flex items-center border-r border-border px-1"
					onClick={(e) => e.stopPropagation()}
				>
					<DragHandle
						attributes={sortable.dragHandleProps.attributes}
						listeners={sortable.dragHandleProps.listeners}
					/>
				</div>
			) : (
				<div className="w-8 shrink-0 border-r border-border" aria-hidden />
			)}

			<TerminalShortcutMenu
				projectId={project.id}
				project={{
					id: project.id,
					name: project.name,
					mainRoute: project.mainRoute,
				}}
				route={menuRoute}
				isTerminal={isTerminal}
				className="min-w-0 flex-1"
			>
				{content}
			</TerminalShortcutMenu>
		</div>
	);
}
