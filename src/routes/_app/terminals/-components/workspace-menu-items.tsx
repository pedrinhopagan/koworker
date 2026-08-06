import { Pencil, Plus, Target, Terminal, Trash2 } from "lucide-react";
import type { ComponentPropsWithoutRef, ElementType } from "react";

import { ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";
import { LucideIcon } from "@/lib/lucide-icon";
import { openProjectRoute, openProjectTerminal } from "@/lib/terminal";
import type { WorkspaceProjectRef } from "../-utils/resolve-workspace-project";
import type { KwTerminalActions } from "../-utils/use-kw-terminal-actions";

type MenuItemComponent = ElementType<ComponentPropsWithoutRef<typeof ContextMenuItem>>;
type MenuSeparatorComponent = ElementType<ComponentPropsWithoutRef<typeof ContextMenuSeparator>>;

type WorkspaceMenuItemsProps = {
	workspaceId: string;
	displayName: string;
	project: WorkspaceProjectRef | null;
	actions: KwTerminalActions;
	Item?: MenuItemComponent;
	Separator?: MenuSeparatorComponent;
	onRename: () => void;
	onCloseWorkspace: () => void;
};

export function WorkspaceMenuItems({
	workspaceId,
	displayName,
	project,
	actions,
	Item = ContextMenuItem,
	Separator = ContextMenuSeparator,
	onRename,
	onCloseWorkspace,
}: WorkspaceMenuItemsProps) {
	const routes = [...(project?.routes ?? [])].sort(function (left, right) {
		return (left.displayOrder ?? 0) - (right.displayOrder ?? 0);
	});

	return (
		<>
			<Item
				onSelect={function () {
					actions.workspaceFocus.mutate({ workspaceId });
				}}
			>
				<Target className="size-4" />
				Focar workspace
			</Item>

			<Item
				onSelect={function () {
					actions.tabCreate.mutate({ workspaceId });
				}}
			>
				<Plus className="size-4" />
				Nova tab
			</Item>

			<Item
				onSelect={function () {
					onRename();
				}}
			>
				<Pencil className="size-4" />
				Renomear workspace
			</Item>

			{project && (
				<>
					<Separator />

					<Item
						onSelect={function () {
							void openProjectTerminal({
								id: project.id,
								name: project.name,
								mainRoute: project.mainRoute,
							});
						}}
					>
						<Terminal className="size-4" />
						Terminal do projeto
					</Item>

					{routes.map(function (route) {
						return (
							<Item
								key={route.id}
								onSelect={function () {
									void openProjectRoute({
										projectId: project.id,
										route: { id: route.id, name: route.name },
									});
								}}
							>
								<LucideIcon name={route.icon ?? "FolderOpen"} className="size-4" />
								<span className="min-w-0 flex-1 truncate">{route.name}</span>
							</Item>
						);
					})}
				</>
			)}

			<Separator />

			<Item
				onSelect={function () {
					onCloseWorkspace();
				}}
				className="text-destructive"
			>
				<Trash2 className="size-4" />
				Fechar {displayName}
			</Item>
		</>
	);
}
