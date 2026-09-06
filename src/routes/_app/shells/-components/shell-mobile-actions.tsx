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
}: {
	canReopen: boolean;
	reopening: boolean;
	onReopen: () => void;
	onConversation: (cli: InvokeCli) => void;
	onShell: () => void;
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
			<div className="grid grid-cols-3 gap-2">
				<Button variant="outline" className="h-12" onClick={() => onConversation("claude")}>
					<AgentCliIcon agent="claude" className="size-4" />
					Claude
				</Button>
				<Button variant="outline" className="h-12" onClick={() => onConversation("codex")}>
					<AgentCliIcon agent="codex" className="size-4" />
					Codex
				</Button>
				<Button variant="outline" className="h-12" onClick={onShell}>
					<SquareTerminal className="size-4" />
					Shell
				</Button>
			</div>
		</div>
	);
}
