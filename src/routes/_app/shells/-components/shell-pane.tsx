import { useState } from "react";

import type { TerminalWorkspaceEntry } from "@/api/schemas/terminal-workspace";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import type { TerminalWorkspaceActions } from "../-utils/use-terminal-workspace";
import { ShellTerminal } from "./shell-terminal";

export function ShellPane({
	entry,
	actions,
}: {
	entry: Extract<TerminalWorkspaceEntry, { kind: "shell" }>;
	actions: TerminalWorkspaceActions;
}) {
	const [liveStatus, setLiveStatus] = useState<"live" | "exited" | "closed" | null>(null);
	const status = liveStatus ?? (entry.status === "exited" ? "exited" : "live");

	return (
		<div data-component="shell-pane" className="flex min-h-0 min-w-0 flex-1 flex-col">
			{status === "live" && !entry.capabilities.converse && (
				<div
					role="status"
					className="shrink-0 border-b border-border px-3 py-2 text-xs text-muted-foreground"
				>
					Inicie claude, codex ou codex-personal neste terminal. O chat fica disponível quando o
					agente for detectado.
				</div>
			)}
			<div className="relative flex min-h-0 flex-1 flex-col">
				<ShellTerminal
					shellId={entry.id}
					cwd={entry.cwd}
					className="flex min-h-0 w-full flex-1 flex-col"
					disabled={status !== "live"}
					onStatus={(next) => setLiveStatus(next)}
				/>

				{status !== "live" && (
					<div className="flex shrink-0 items-center justify-between gap-2 border-t border-border bg-chrome px-3 py-2">
						<Text size="sm" className="font-semibold">
							{status === "exited"
								? `Shell encerrado (código ${entry.exitCode ?? "?"})`
								: "Shell fechado"}
						</Text>
						<Button variant="outline" size="sm" onClick={() => actions.close(entry)}>
							Retirar da lista
						</Button>
					</div>
				)}
			</div>
		</div>
	);
}
