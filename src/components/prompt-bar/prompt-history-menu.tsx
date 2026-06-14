import { History } from "lucide-react";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type PromptHistoryMenuProps = {
	history: string[];
	onPick: (text: string) => void;
};

export function PromptHistoryMenu({ history, onPick }: PromptHistoryMenuProps) {
	const empty = history.length === 0;

	return (
		<DropdownMenu>
			<Tooltip label="Histórico de prompts">
				<DropdownMenuTrigger
					aria-label="Histórico de prompts"
					className={cn(
						"flex h-6 w-6 items-center justify-center text-muted-foreground transition-colors hover:text-foreground",
						"disabled:opacity-40",
					)}
					disabled={empty}
				>
					<History className="h-3.5 w-3.5" />
				</DropdownMenuTrigger>
			</Tooltip>
			<DropdownMenuContent align="start" side="top" className="max-h-80 w-80 overflow-y-auto">
				<DropdownMenuLabel>Histórico de prompts</DropdownMenuLabel>
				{history.map((entry, index) => (
					<DropdownMenuItem
						key={`${index}-${entry.slice(0, 12)}`}
						onSelect={() => onPick(entry)}
						className="block whitespace-normal"
					>
						<span className="line-clamp-2 text-xs text-muted-foreground">{entry}</span>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
