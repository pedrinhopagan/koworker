import { Check, Copy, Loader2, MoreVertical, Pencil } from "lucide-react";
import { tv } from "tailwind-variants";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import type { Skill, SkillId } from "./skill-registry";

const skillCardVariants = tv({
	base: cn(
		"relative flex items-center gap-3 p-3 w-full",
		"border border-border bg-card text-foreground",
		"transition-all duration-200 cursor-pointer",
		"hover:border-muted hover:bg-secondary",
		"disabled:opacity-50 disabled:cursor-not-allowed",
		"focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
	),
	variants: {
		isActive: {
			true: "shadow-lg ring-2 ring-offset-2 ring-offset-background",
		},
	},
});

type SkillCardProps = {
	skill: Skill;
	isExecuting: boolean;
	isConfirmMode: boolean;
	disabled?: boolean;
	onExecute: (skillId: SkillId) => void;
	onCopyPrompt: (skillId: SkillId) => void;
	onEditInstructions: (skillId: SkillId) => void;
};

export function SkillCard({
	skill,
	isExecuting,
	isConfirmMode,
	disabled,
	onExecute,
	onCopyPrompt,
	onEditInstructions,
}: SkillCardProps) {
	const Icon = skill.icon;
	const showCheckIcon = isConfirmMode && skill.requiresSubtaskSelection;

	function handleClick() {
		if (disabled || isExecuting) return;
		onExecute(skill.id);
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			handleClick();
		}
	}

	return (
		<div className="relative">
			<button
				type="button"
				onClick={handleClick}
				onKeyDown={handleKeyDown}
				disabled={disabled || isExecuting}
				className={skillCardVariants({
					isActive: isConfirmMode,
				})}
				style={
					isConfirmMode
						? {
								borderColor: skill.color,
								backgroundColor: `${skill.color}1a`,
								color: skill.color,
								boxShadow: `0 4px 12px -2px ${skill.color}30`,
							}
						: undefined
				}
				aria-label={`${skill.label}: ${skill.description}`}
			>
				<div className="flex-shrink-0">
					{isExecuting ? (
						<Loader2 size={20} className="animate-spin" />
					) : showCheckIcon ? (
						<Check size={20} />
					) : (
						<Icon size={20} />
					)}
				</div>
				<div className="flex-1 min-w-0 text-left">
					<div className="text-sm font-medium">
						{isConfirmMode && skill.requiresSubtaskSelection ? "Confirmar" : skill.label}
					</div>
					{!isConfirmMode && (
						<div className="text-xs text-muted-foreground truncate">{skill.description}</div>
					)}
				</div>
			</button>

			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						onClick={(e) => e.stopPropagation()}
						className="absolute top-1 right-1 p-1 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						aria-label={`Menu de opções para ${skill.label}`}
					>
						<MoreVertical size={14} />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" sideOffset={8} className="min-w-[180px] p-0">
					<DropdownMenuItem
						onClick={(e) => {
							e.stopPropagation();
							onCopyPrompt(skill.id);
						}}
						className="px-3 py-2 rounded-none text-muted-foreground data-[highlighted]:bg-muted data-[highlighted]:text-foreground"
					>
						<Copy size={14} />
						<span>Copiar prompt</span>
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={(e) => {
							e.stopPropagation();
							onEditInstructions(skill.id);
						}}
						className="px-3 py-2 rounded-none text-muted-foreground data-[highlighted]:bg-muted data-[highlighted]:text-foreground"
					>
						<Pencil size={14} />
						<span>Editar instruções</span>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			{isConfirmMode && skill.requiresSubtaskSelection && (
				<span
					className="absolute -top-2 -left-2 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-background z-10"
					style={{ backgroundColor: skill.color }}
				>
					Selecionando
				</span>
			)}
		</div>
	);
}
