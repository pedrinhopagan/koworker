import {
	CircleStop,
	Copy,
	FolderOpen,
	GitCompare,
	MessagesSquare,
	Pencil,
	Target,
	X,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import type { TerminalWorkspaceEntry } from "@/api/schemas/terminal-workspace";
import { AgentNavMenuItems } from "@/components/agent-radar/agent-nav-menu-items";
import { RenameDialog } from "@/components/rename-dialog";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { copyToClipboard } from "@/lib/build-prompt";
import { openFolderInOs } from "@/lib/os-share";
import type { TerminalWorkspaceActions } from "../-utils/use-terminal-workspace";

type ShellEntryContextMenuProps = {
	entry: TerminalWorkspaceEntry;
	label: string;
	actions: TerminalWorkspaceActions;
	onOpen: () => void;
	children: ReactNode;
};

export function ShellEntryContextMenu({
	entry,
	label,
	actions,
	onOpen,
	children,
}: ShellEntryContextMenuProps) {
	const [renaming, setRenaming] = useState(false);

	if (entry.kind === "agent") {
		return (
			<ContextMenu>
				<ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
				<ContextMenuContent className="w-[220px]">
					<ContextMenuLabel className="truncate">{label}</ContextMenuLabel>
					{entry.capabilities.converse && (
						<ContextMenuItem onSelect={onOpen}>
							<MessagesSquare className="size-4" />
							Ver conversa
						</ContextMenuItem>
					)}
					{entry.capabilities.focusExternal && (
						<ContextMenuItem onSelect={() => actions.focusExternal(entry)}>
							<Target className="size-4" />
							Focar no kw-terminal
						</ContextMenuItem>
					)}

					{(entry.taskId || entry.projectId) && <ContextMenuSeparator />}

					<AgentNavMenuItems
						projectId={entry.projectId}
						projectName={entry.projectName}
						taskId={entry.taskId}
						taskTitle={entry.taskTitle}
					/>

					{(entry.capabilities.diff || entry.capabilities.interrupt) && <ContextMenuSeparator />}

					{entry.capabilities.diff && (
						<ContextMenuItem onSelect={() => actions.openDiff(entry)}>
							<GitCompare className="size-4" />
							Ver diff no kw-diff
						</ContextMenuItem>
					)}

					{entry.capabilities.interrupt && entry.status === "working" && (
						<ContextMenuItem onSelect={() => actions.interrupt(entry)}>
							<CircleStop className="size-4" />
							Interromper
						</ContextMenuItem>
					)}

					{entry.capabilities.close && <ContextMenuSeparator />}

					{entry.capabilities.close && (
						<ContextMenuItem
							onSelect={() => actions.close(entry)}
							className="text-destructive focus:text-destructive"
						>
							<X className="size-4" />
							Fechar pane
						</ContextMenuItem>
					)}
				</ContextMenuContent>
			</ContextMenu>
		);
	}

	return (
		<>
			<ContextMenu>
				<ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
				<ContextMenuContent className="w-[220px]">
					<ContextMenuLabel className="truncate">{label}</ContextMenuLabel>
					{entry.capabilities.rename && (
						<ContextMenuItem onSelect={() => setRenaming(true)}>
							<Pencil className="size-4" />
							Renomear
						</ContextMenuItem>
					)}
					<ContextMenuItem
						onSelect={async () => {
							if (await copyToClipboard(entry.cwd)) {
								toast.success("Caminho copiado");
							}
						}}
					>
						<Copy className="size-4" />
						Copiar caminho
					</ContextMenuItem>
					<ContextMenuItem onSelect={() => void openFolderInOs(entry.cwd)}>
						<FolderOpen className="size-4" />
						Abrir pasta no sistema
					</ContextMenuItem>
					{entry.capabilities.close && <ContextMenuSeparator />}
					{entry.capabilities.close && (
						<ContextMenuItem
							onSelect={() => actions.close(entry)}
							className="text-destructive focus:text-destructive"
						>
							<X className="size-4" />
							Fechar shell
						</ContextMenuItem>
					)}
				</ContextMenuContent>
			</ContextMenu>

			<RenameDialog
				open={renaming}
				title={`Renomear ${label}`}
				initial={entry.label}
				pending={false}
				onClose={() => setRenaming(false)}
				onSubmit={(nextLabel) => {
					actions.rename(entry, nextLabel);
					setRenaming(false);
				}}
			/>
		</>
	);
}
