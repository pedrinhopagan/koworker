import { MoreVertical, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { KwTerminalActions } from "../-utils/use-kw-terminal-actions";
import { RenameDialog } from "./rename-dialog";

type WorkspaceActionsMenuProps = {
	workspaceId: string;
	label: string;
	actions: KwTerminalActions;
};

export function WorkspaceActionsMenu({ workspaceId, label, actions }: WorkspaceActionsMenuProps) {
	const [renaming, setRenaming] = useState(false);
	const [closing, setClosing] = useState(false);

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button size="icon-sm" variant="ghost" aria-label={`Ações do workspace ${label}`}>
						<MoreVertical className="size-4" />
					</Button>
				</DropdownMenuTrigger>

				<DropdownMenuContent align="end">
					<DropdownMenuItem onSelect={() => actions.workspaceFocus.mutate({ workspaceId })}>
						<Target className="size-4" />
						Focar workspace
					</DropdownMenuItem>

					<DropdownMenuItem onSelect={() => actions.tabCreate.mutate({ workspaceId })}>
						<Plus className="size-4" />
						Nova tab
					</DropdownMenuItem>

					<DropdownMenuItem onSelect={() => setRenaming(true)}>
						<Pencil className="size-4" />
						Renomear
					</DropdownMenuItem>

					<DropdownMenuSeparator />

					<DropdownMenuItem onSelect={() => setClosing(true)} className="text-destructive">
						<Trash2 className="size-4" />
						Fechar workspace
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<RenameDialog
				open={renaming}
				title="Renomear workspace"
				initial={label}
				pending={actions.workspaceRename.isPending}
				onClose={() => setRenaming(false)}
				onSubmit={(next) =>
					actions.workspaceRename.mutate(
						{ workspaceId, label: next },
						{ onSuccess: () => setRenaming(false) },
					)
				}
			/>

			<ConfirmDialog
				open={closing}
				onClose={() => setClosing(false)}
				onConfirm={() =>
					actions.workspaceClose.mutate({ workspaceId }, { onSuccess: () => setClosing(false) })
				}
				title={`Fechar ${label}?`}
				description="Todas as tabs e agents deste workspace são encerrados."
				confirmLabel="Fechar"
				variant="danger"
				loading={actions.workspaceClose.isPending}
			/>
		</>
	);
}
