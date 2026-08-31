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
			<div className="relative min-h-0 flex-1">
				<ShellTerminal
					shellId={entry.id}
					cwd={entry.cwd}
					className="h-full w-full"
					onStatus={(next) => setLiveStatus(next)}
				/>

				{status !== "live" && (
					<div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/80">
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
