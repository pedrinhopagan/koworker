import { MoreVertical, Pencil, Target, X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { KwTerminalActions } from "../-utils/use-kw-terminal-actions";
import { RenameDialog } from "./rename-dialog";

type TerminalTabRowProps = {
	tabId: string;
	label: string;
	focused: boolean;
	actions: KwTerminalActions;
};

// Tab sem agent: é shell puro, então não tem conversa para abrir — só as ações de terminal.
export function TerminalTabRow({ tabId, label, focused, actions }: TerminalTabRowProps) {
	const [renaming, setRenaming] = useState(false);

	return (
		<li className="flex items-center gap-2 border border-border bg-card px-3 py-1.5">
			<span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
				{label}
			</span>

			{focused && (
				<Badge variant="success" className="shrink-0">
					foco
				</Badge>
			)}

			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						aria-label={`Ações da tab ${label}`}
						className="flex size-8 shrink-0 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
					>
						<MoreVertical className="size-4" />
					</button>
				</DropdownMenuTrigger>

				<DropdownMenuContent align="end">
					<DropdownMenuItem onSelect={() => actions.tabFocus.mutate({ tabId })}>
						<Target className="size-4" />
						Focar tab
					</DropdownMenuItem>

					<DropdownMenuItem onSelect={() => setRenaming(true)}>
						<Pencil className="size-4" />
						Renomear
					</DropdownMenuItem>

					<DropdownMenuItem
						onSelect={() => actions.tabClose.mutate({ tabId })}
						className="text-destructive"
					>
						<X className="size-4" />
						Fechar tab
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<RenameDialog
				open={renaming}
				title="Renomear tab"
				initial={label}
				pending={actions.tabRename.isPending}
				onClose={() => setRenaming(false)}
				onSubmit={(next) =>
					actions.tabRename.mutate({ tabId, label: next }, { onSuccess: () => setRenaming(false) })
				}
			/>
		</li>
	);
}
