import {
	CirclePlay,
	FileSearch,
	GitCommitHorizontal,
	ListChecks,
	MoreVertical,
	Rocket,
} from "lucide-react";
import { tv } from "tailwind-variants";

import { Text } from "@/components/typography";
import { cn } from "@/lib/utils";

const actionButtonVariants = tv({
	base: cn(
		"relative flex-1 flex flex-col items-center justify-center gap-2 p-4",
		"border border-border bg-card text-foreground",
		"transition-all duration-200",
		"hover:border-muted hover:bg-secondary",
		"disabled:opacity-50 disabled:cursor-not-allowed",
	),
	variants: {
		suggested: {
			true: "shadow-lg",
		},
	},
});

type Action = {
	id: string;
	label: string;
	icon: typeof Rocket;
	color: string;
};

const ACTIONS: Action[] = [
	{ id: "structure", label: "Estruturar", icon: ListChecks, color: "#61afef" },
	{ id: "execute_all", label: "Executar Tudo", icon: Rocket, color: "#98c379" },
	{ id: "execute_subtask", label: "Executar Subtask", icon: CirclePlay, color: "#e5c07b" },
	{ id: "review", label: "Revisar", icon: FileSearch, color: "#c678dd" },
	{ id: "commit", label: "Commit", icon: GitCommitHorizontal, color: "#56b6c2" },
];

type TaskActionsProps = {
	suggestedActionId?: string;
	disabled?: boolean;
};

export function TaskActions({ suggestedActionId = "execute_subtask", disabled }: TaskActionsProps) {
	function handleActionClick(actionId: string) {
		console.log("Action clicked:", actionId);
	}

	return (
		<section className="space-y-3">
			<div className="flex items-center justify-between">
				<Text size="xs" tone="muted" className="uppercase tracking-wide">
					Ações
				</Text>
			</div>

			<div className="grid grid-cols-1 gap-2">
				{ACTIONS.map((action) => {
					const isSuggested = suggestedActionId === action.id;
					const Icon = action.icon;

					return (
						<div key={action.id} className="relative">
							<button
								type="button"
								onClick={() => handleActionClick(action.id)}
								disabled={disabled}
								className={actionButtonVariants({ suggested: isSuggested })}
								style={
									isSuggested
										? {
												borderColor: action.color,
												backgroundColor: `${action.color}1a`,
												color: action.color,
												boxShadow: `0 4px 12px -2px ${action.color}30`,
											}
										: undefined
								}
							>
								<Icon size={20} />
								<span className="text-sm font-medium">{action.label}</span>
							</button>

							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									console.log("Menu:", action.id);
								}}
								className="absolute top-1 right-1 p-1 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
							>
								<MoreVertical size={14} />
							</button>

							{isSuggested && (
								<span
									className="absolute -top-2 -left-2 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-background z-10"
									style={{ backgroundColor: action.color }}
								>
									Sugestão
								</span>
							)}
						</div>
					);
				})}
			</div>
		</section>
	);
}
