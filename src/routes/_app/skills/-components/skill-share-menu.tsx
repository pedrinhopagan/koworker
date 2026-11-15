import {
	ClipboardCopy,
	Download,
	FileArchive,
	Files,
	FolderOpen,
	Link2,
	Share2,
	type LucideIcon,
} from "lucide-react";

import { DocSheetActionButton } from "@/components/doc-mobile-actions-drawer";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";

export type SkillShareHandlers = {
	flush: () => Promise<void>;
	onDownloadZip: () => Promise<void>;
	onCopyZip: () => Promise<void>;
	onCopySkill: () => Promise<void>;
	onCopyText: () => Promise<void>;
	onCopyPath: () => Promise<void>;
	onOpenInOs: () => Promise<void>;
};

type ShareAction = {
	key: keyof Omit<SkillShareHandlers, "flush">;
	label: string;
	icon: LucideIcon;
	group: string;
};

const SHARE_ACTIONS: ShareAction[] = [
	{ key: "onDownloadZip", label: "Baixar .zip", icon: Download, group: "Pacote" },
	{ key: "onCopyZip", label: "Copiar .zip para colar", icon: FileArchive, group: "Pacote" },
	{ key: "onCopySkill", label: "Copiar SKILL.md", icon: ClipboardCopy, group: "Texto" },
	{ key: "onCopyText", label: "Copiar skill completa", icon: Files, group: "Texto" },
	{ key: "onCopyPath", label: "Copiar caminho da pasta", icon: Link2, group: "Local" },
	{ key: "onOpenInOs", label: "Abrir pasta no sistema", icon: FolderOpen, group: "Local" },
];

async function runShare(handlers: SkillShareHandlers, key: ShareAction["key"]) {
	try {
		await handlers.flush();
		await handlers[key]();
	} catch (error) {
		toast.error(error instanceof Error ? error.message : "Não foi possível compartilhar a skill");
	}
}

export function SkillShareMenu(handlers: SkillShareHandlers) {
	const groups = [...new Set(SHARE_ACTIONS.map((action) => action.group))];

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button type="button" variant="outline" size="compact">
					<Share2 className="size-3.5" />
					Compartilhar
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-60">
				{groups.map((group, index) => (
					<div key={group}>
						{index > 0 && <DropdownMenuSeparator />}
						<DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
							{group}
						</DropdownMenuLabel>
						{SHARE_ACTIONS.filter((action) => action.group === group).map((action) => (
							<DropdownMenuItem
								key={action.key}
								onSelect={() => void runShare(handlers, action.key)}
							>
								<action.icon />
								{action.label}
							</DropdownMenuItem>
						))}
					</div>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function SkillShareActionsStacked({
	onAction,
	...handlers
}: SkillShareHandlers & { onAction: () => void }) {
	return (
		<>
			{SHARE_ACTIONS.map((action) => (
				<DocSheetActionButton
					key={action.key}
					icon={<action.icon className="size-[18px]" />}
					label={action.label}
					onClick={() => {
						onAction();
						void runShare(handlers, action.key);
					}}
				/>
			))}
		</>
	);
}
