import { Play, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	closeProjectTerminal,
	forceNewRouteTab,
	forceNewTerminalTab,
	type ProjectInfo,
	runRouteInBackground,
	runTerminalInBackground,
	type TaskInfo,
} from "@/lib/terminal";
import { cn } from "@/lib/utils";

type Route = {
	id: string;
	name: string;
	route: string;
	command?: string;
};

type TerminalShortcutMenuProps = {
	projectId: string;
	project: ProjectInfo;
	route?: Route;
	task?: TaskInfo;
	children: React.ReactNode;
	className?: string;
	isTerminal?: boolean;
	disabled?: boolean;
};

export function TerminalShortcutMenu({
	projectId,
	project,
	route,
	task,
	children,
	className,
	isTerminal,
	disabled,
}: TerminalShortcutMenuProps) {
	const [isOpen, setIsOpen] = useState(false);

	function handleContextMenu(e: React.MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		setIsOpen(true);
	}

	async function handleRunInBackground() {
		if (isTerminal) {
			const taskInfo: TaskInfo = task ?? {
				id: `project_${project.id.slice(0, 8)}`,
				title: project.name,
			};
			await runTerminalInBackground(project, taskInfo);
		} else if (route) {
			await runRouteInBackground(projectId, project.name, {
				id: route.id,
				name: route.name,
				path: route.route,
				command: route.command,
			});
		}
		setIsOpen(false);
	}

	async function handleOpenNew() {
		if (isTerminal) {
			const taskInfo: TaskInfo = task ?? {
				id: `project_${project.id.slice(0, 8)}`,
				title: project.name,
			};
			await forceNewTerminalTab(project, taskInfo);
		} else if (route) {
			await forceNewRouteTab(projectId, project.name, {
				id: route.id,
				name: route.name,
				path: route.route,
				command: route.command,
			});
		}
		setIsOpen(false);
	}

	async function handleCloseAll() {
		await closeProjectTerminal(projectId, project.name);
		setIsOpen(false);
	}

	const label = isTerminal ? "Terminal do projeto" : (route?.name ?? "Atalho");

	return (
		<DropdownMenu open={isOpen} onOpenChange={setIsOpen} modal={false}>
			<DropdownMenuTrigger asChild disabled={disabled}>
				<span
					className={cn("cursor-pointer inline-flex", className)}
					onContextMenu={handleContextMenu}
				>
					{children}
				</span>
			</DropdownMenuTrigger>
			{isOpen && (
				<DropdownMenuContent
					align="start"
					className="w-[200px]"
					forceMount
					onCloseAutoFocus={(e) => e.preventDefault()}
				>
					<div className="px-3 py-2 text-xs text-muted-foreground uppercase tracking-wider">
						{label}
					</div>
					<DropdownMenuItem onSelect={handleRunInBackground}>
						<Play className="size-4 mr-2" />
						Rodar em background
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={handleOpenNew}>
						<Plus className="size-4 mr-2" />
						Abrir novo
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem onSelect={handleCloseAll} className="text-destructive">
						<Trash2 className="size-4 mr-2" />
						Fechar todos
					</DropdownMenuItem>
				</DropdownMenuContent>
			)}
		</DropdownMenu>
	);
}
