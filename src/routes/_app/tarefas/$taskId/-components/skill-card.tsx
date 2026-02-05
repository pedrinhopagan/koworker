import { Check, Copy, Layers, MoreVertical, Pencil } from "lucide-react";
import { useState } from "react";
import { tv } from "tailwind-variants";
import { Chip } from "@/components/ui/chip";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { LucideIcon } from "@/lib/lucide-icon";
import { cn } from "@/lib/utils";

import type { TaskSkill } from "@/types/skills";

const skillCardVariants = tv({
	base: cn(
		"relative flex items-center jcsutify-between gap-3 p-3 w-full min-w-0",
		"border border-border bg-card text-foreground",
		"transition-all duration-200 cursor-pointer",
		"hover:border-muted hover:bg-secondary",
		"disabled:opacity-50 disabled:cursor-not-allowed",
		"focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
		"overflow-hidden",
	),
	variants: {
		isActive: {
			true: "shadow-lg ring-2 ring-offset-2 ring-offset-background",
		},
	},
});

type SkillCardProps = {
	skill: TaskSkill;
	variant?: "task" | "manage";
	isConfirmMode?: boolean;
	isSelected?: boolean;
	disabled?: boolean;
	onCopyPrompt?: (skillId: string) => Promise<boolean> | boolean;
	onCancelSelection?: () => void;
	onEditInstructions?: (skillId: string) => void;
	onSelect?: (skillId: string) => void;
};

export function SkillCard({
	skill,
	variant = "task",
	isConfirmMode = false,
	isSelected = false,
	disabled,
	onCopyPrompt,
	onCancelSelection,
	onEditInstructions,
	onSelect,
}: SkillCardProps) {
	const isManage = variant === "manage";
	const isActive = isManage ? isSelected : isConfirmMode;
	const showCheckIcon = !isManage && isConfirmMode && skill.requiresSubtaskSelection;
	const [justCopied, setJustCopied] = useState(false);
	const showActions = !isManage && !isConfirmMode && onCopyPrompt && onEditInstructions;
	const showSourceChip = isManage && skill.source === "builtin";
	const showCancel =
		!isManage && isConfirmMode && skill.requiresSubtaskSelection && Boolean(onCancelSelection);

	async function handleClick() {
		if (disabled) return;

		if (isManage) {
			onSelect?.(skill.id);
			return;
		}

		if (!onCopyPrompt) return;
		const result = onCopyPrompt(skill.id);
		const copied = typeof result === "boolean" ? result : await result;
		if (!copied) return;

		setJustCopied(true);
		setTimeout(() => setJustCopied(false), 1500);
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			void handleClick();
		}
	}

	return (
		<div className="relative">
			<button
				type="button"
				onClick={handleClick}
				onKeyDown={handleKeyDown}
				disabled={disabled}
				className={cn(
					skillCardVariants({
						isActive,
					}),
					showCancel && "pr-16",
					"relative",
				)}
				style={
					!isManage && isConfirmMode
						? {
								// borderColor: skill.color,
								backgroundColor: `${skill.color}1a`,
								color: skill.color,
								// boxShadow: `0 4px 12px -2px ${skill.color}30`,
							}
						: {
								// borderColor: skill.color,
							}
				}
				aria-label={`${skill.label}: ${skill.description}`}
			>
				<div
					className={cn(
						"shrink-0 flex h-9 w-9 items-center justify-center border border-border bg-muted/40",
						isManage && "rounded-md",
					)}
					style={{
						borderColor: skill.color,
						color: skill.color,
					}}
				>
					{justCopied ? (
						<Check size={20} className="text-green-500" />
					) : showCheckIcon ? (
						<Check size={20} />
					) : (
						<LucideIcon name={skill.icon} className="size-5" />
					)}
				</div>
				<div className="flex-1 min-w-0 text-left">
					<div className="text-sm font-medium flex items-center justify-between gap-2 min-w-0">
						<div className="flex gap-2">
							<span className="truncate">
								{isConfirmMode && skill.requiresSubtaskSelection ? "Copiar" : skill.label}
							</span>
							{skill.requiresSubtaskSelection && (
								<div className=" left-2">
									<Tooltip label="Multi-selecao" side="right">
										<Layers className="size-4 text-foreground" />
									</Tooltip>
								</div>
							)}
						</div>
						{justCopied && <span className="text-xs text-green-500 font-normal">Copiado!</span>}
						{showSourceChip && (
							<Chip size="xs" variant="primary">
								Koworker
							</Chip>
						)}
					</div>
					{!isConfirmMode && (
						<div className="text-xs text-muted-foreground flex items-center gap-2 min-w-0">
							<span className="line-clamp-1 min-w-0">{skill.description}</span>
						</div>
					)}
				</div>
				{showActions && (
					<>
						<Copy size={14} className="text-muted-foreground" />
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									onClick={(e) => e.stopPropagation()}
									className="p-2 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
									aria-label={`Menu de opcoes para ${skill.label}`}
								>
									<MoreVertical size={14} />
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem
									onClick={(e) => {
										e.stopPropagation();
										onEditInstructions?.(skill.id);
									}}
								>
									<Pencil size={14} />
									<span>Editar instrucoes</span>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</>
				)}
			</button>

			{showCancel && (
				<button
					type="button"
					onClick={(event) => {
						event.stopPropagation();
						onCancelSelection?.();
					}}
					disabled={disabled}
					className="absolute right-2 top-2 px-2 py-1 text-[10px] uppercase tracking-wide border border-border bg-background text-foreground hover:bg-secondary transition-colors"
				>
					Cancelar
				</button>
			)}
		</div>
	);
}
