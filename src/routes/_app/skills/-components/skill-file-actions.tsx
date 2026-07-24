import { ClipboardCopy, FolderOpen, Link2, MoreVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";

type SkillFileActionsProps = {
	path: string;
	kind: "text" | "binary";
	onCopyContent: () => void;
	onCopyPath: () => void;
	onOpenFolder: () => void;
};

const ACTIONS = [
	{ id: "content", label: "Copiar conteúdo", icon: ClipboardCopy },
	{ id: "path", label: "Copiar caminho relativo", icon: Link2 },
	{ id: "folder", label: "Abrir na pasta", icon: FolderOpen },
] as const;

function actionHandler(id: (typeof ACTIONS)[number]["id"], props: SkillFileActionsProps) {
	if (id === "content") {
		return props.onCopyContent;
	}
	if (id === "path") {
		return props.onCopyPath;
	}

	return props.onOpenFolder;
}

export function SkillFileContextActions(props: SkillFileActionsProps) {
	return (
		<ContextMenuContent aria-label={`Ações de ${props.path}`}>
			{ACTIONS.map((action) => {
				const Icon = action.icon;
				return (
					<ContextMenuItem
						key={action.id}
						disabled={action.id === "content" && props.kind === "binary"}
						onSelect={actionHandler(action.id, props)}
					>
						<Icon />
						{action.label}
					</ContextMenuItem>
				);
			})}
		</ContextMenuContent>
	);
}

export function SkillFileActionsButton(props: SkillFileActionsProps) {
	return (
		<Tooltip label={`Ações de ${props.path}`}>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={`Ações de ${props.path}`}
						className="size-7 shrink-0"
					>
						<MoreVertical className="size-3.5" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					{ACTIONS.map((action) => {
						const Icon = action.icon;
						return (
							<DropdownMenuItem
								key={action.id}
								disabled={action.id === "content" && props.kind === "binary"}
								onSelect={actionHandler(action.id, props)}
							>
								<Icon />
								{action.label}
							</DropdownMenuItem>
						);
					})}
				</DropdownMenuContent>
			</DropdownMenu>
		</Tooltip>
	);
}

export { ContextMenuTrigger };
