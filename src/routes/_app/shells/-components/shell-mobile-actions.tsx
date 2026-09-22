import { Loader2, RotateCcw, SquareTerminal } from "lucide-react";

import { AgentCliIcon } from "@/components/agent-radar/agent-cli";
import { Button } from "@/components/ui/button";
import type { InvokeCli } from "@/constants/invoke";

export function ShellMobileActions({
	canReopen,
	reopening,
	onReopen,
	onConversation,
	onShell,
	onPersonal,
}: {
	canReopen: boolean;
	reopening: boolean;
	onReopen: () => void;
	onConversation: (cli: InvokeCli) => void;
	onShell: () => void;
	onPersonal: () => void;
}) {
	return (
		<div
			data-component="shell-mobile-actions"
			className="flex shrink-0 flex-col gap-2 border-t border-border bg-chrome p-2"
		>
			{canReopen && (
				<Button variant="outline" className="h-11 w-full" disabled={reopening} onClick={onReopen}>
					{reopening ? <Loader2 className="animate-spin" /> : <RotateCcw />}
					Reabrir terminais
				</Button>
			)}
			<div className="grid grid-cols-4 gap-1.5">
				<Button
					variant="outline"
					className="h-14 flex-col gap-1 px-1 text-xs"
					onClick={() => onConversation("claude")}
				>
					<AgentCliIcon agent="claude" className="size-4" />
					Claude
				</Button>
				<Button
					variant="outline"
					className="h-14 flex-col gap-1 px-1 text-xs"
					onClick={() => onConversation("codex")}
				>
					<AgentCliIcon agent="codex" className="size-4" />
					Codex
				</Button>
				<Button
					variant="outline"
					className="h-14 flex-col gap-1 px-1 text-xs"
					aria-label="Codex pessoal"
					onClick={onPersonal}
				>
					<AgentCliIcon agent="codex" className="size-4" />
					Pessoal
				</Button>
				<Button variant="outline" className="h-14 flex-col gap-1 px-1 text-xs" onClick={onShell}>
					<SquareTerminal className="size-4" />
					Shell
				</Button>
			</div>
		</div>
	);
}
