import { ArrowLeft, Loader2, RotateCcw, SquareTerminal } from "lucide-react";
import { useState } from "react";

import { AgentCliIcon } from "@/components/agent-radar/agent-cli";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import type { ShellLaunchCommand } from "@/constants/shell-launch";

const BUTTON = "h-14 flex-col gap-1 px-1 text-xs";

export function ShellMobileActions({
	canReopen,
	reopening,
	onReopen,
	onLaunch,
}: {
	canReopen: boolean;
	reopening: boolean;
	onReopen: () => void;
	onLaunch: (command: ShellLaunchCommand) => void;
}) {
	const [choosingCodex, setChoosingCodex] = useState(false);

	function launch(command: ShellLaunchCommand) {
		setChoosingCodex(false);
		onLaunch(command);
	}

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
			{choosingCodex && (
				<div className="flex flex-col gap-1.5">
					<Text size="xs" tone="muted" className="px-1">
						Qual conta do Codex?
					</Text>
					<div className="grid grid-cols-[auto_1fr_1fr] gap-1.5">
						<Button
							variant="ghost"
							className="h-14 px-3"
							aria-label="Voltar"
							onClick={() => setChoosingCodex(false)}
						>
							<ArrowLeft className="size-4" />
						</Button>
						<Button variant="outline" className={BUTTON} onClick={() => launch("codex")}>
							<AgentCliIcon agent="codex" className="size-4" />
							Padrão
						</Button>
						<Button variant="outline" className={BUTTON} onClick={() => launch("codex-personal")}>
							<AgentCliIcon agent="codex" className="size-4" />
							Pessoal
						</Button>
					</div>
				</div>
			)}
			{!choosingCodex && (
				<div className="grid grid-cols-4 gap-1.5">
					<Button variant="outline" className={BUTTON} onClick={() => launch("claude")}>
						<AgentCliIcon agent="claude" className="size-4" />
						Claude
					</Button>
					<Button variant="outline" className={BUTTON} onClick={() => setChoosingCodex(true)}>
						<AgentCliIcon agent="codex" className="size-4" />
						Codex
					</Button>
					<Button variant="outline" className={BUTTON} onClick={() => launch("pi")}>
						<AgentCliIcon agent="pi" className="size-4" />
						Pi
					</Button>
					<Button variant="outline" className={BUTTON} onClick={() => launch("shell")}>
						<SquareTerminal className="size-4" />
						Shell
					</Button>
				</div>
			)}
		</div>
	);
}
