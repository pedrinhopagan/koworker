import { Check, Copy, MoreVertical, Pencil } from "lucide-react";
import { useState } from "react";
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
	isConfirmMode: boolean;
	disabled?: boolean;
	onCopyPrompt: (skillId: SkillId) => void;
	onEditInstructions: (skillId: SkillId) => void;
};

export function SkillCard({
	skill,
	isConfirmMode,
	disabled,
	onCopyPrompt,
	onEditInstructions,
}: SkillCardProps) {
	const Icon = skill.icon;
	const showCheckIcon = isConfirmMode && skill.requiresSubtaskSelection;
	const [justCopied, setJustCopied] = useState(false);

	function handleClick() {
		if (disabled) return;

		onCopyPrompt(skill.id);

		setJustCopied(true);
		setTimeout(() => setJustCopied(false), 1500);
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
				disabled={disabled}
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
				<div className="shrink-0">
					{justCopied ? (
						<Check size={20} className="text-green-500" />
					) : showCheckIcon ? (
						<Check size={20} />
					) : (
						<Icon size={20} />
					)}
				</div>
				<div className="flex-1 min-w-0 text-left">
					<div className="text-sm font-medium flex items-center gap-2">
						{isConfirmMode && skill.requiresSubtaskSelection ? "Confirmar" : skill.label}
						{justCopied && <span className="text-xs text-green-500 font-normal">Copiado!</span>}
					</div>
					{!isConfirmMode && (
						<div className="text-xs text-muted-foreground truncate">{skill.description}</div>
					)}
				</div>
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
					<DropdownMenuContent align="end" className="min-w-[">
						<DropdownMenuItem
							onClick={(e) => {
								e.stopPropagation();
								onEditInstructions(skill.id);
							}}
						>
							<Pencil size={14} />
							<span>Editar instrucoes</span>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</button>

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
