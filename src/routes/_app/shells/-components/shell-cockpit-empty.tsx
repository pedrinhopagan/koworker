import { Bot, Plus, SquareTerminal } from "lucide-react";

import type { TerminalWorkspaceEntry } from "@/api/schemas/terminal-workspace";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { terminalWorkspaceEntryTitle, terminalWorkspaceStatusText } from "./shell-groups";

type ShellCockpitEmptyProps = {
	entries: TerminalWorkspaceEntry[];
	onSelect: (key: string) => void;
	onNewShell: () => void;
	onNewConversation: () => void;
};

export function ShellCockpitEmpty({
	entries,
	onSelect,
	onNewShell,
	onNewConversation,
}: ShellCockpitEmptyProps) {
	const recent = entries.slice(0, 3);

	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col border border-border bg-card/50">
			<div className="border-b border-border px-5 py-5 sm:px-6">
				<Text size="xs" tone="muted" className="uppercase tracking-[0.16em]">
					Agent workspace
				</Text>
				<Title as="h2" className="mt-2 text-2xl tracking-[-0.03em]">
					{entries.length > 0 ? "Escolha o próximo contexto" : "Abra seu primeiro contexto"}
				</Title>
				<Text size="sm" tone="muted" className="mt-2 max-w-lg">
					Terminais e conversas compartilham este cockpit sem disputar espaço com a navegação
					global.
				</Text>
			</div>

			{recent.length > 0 && (
				<div className="border-b border-border px-3 py-3 sm:px-4">
					<Text size="xs" tone="muted" className="mb-2 px-2 uppercase tracking-[0.12em]">
						Sessões disponíveis
					</Text>
					<div className="divide-y divide-border border border-border">
						{recent.map((entry) => (
							<button
								key={entry.key}
								type="button"
								onClick={() => onSelect(entry.key)}
								className="flex w-full items-center gap-3 bg-background px-3 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
							>
								<span className="grid size-8 shrink-0 place-items-center border border-border text-primary">
									{entry.kind === "agent" ? (
										<Bot className="size-4" />
									) : (
										<SquareTerminal className="size-4" />
									)}
								</span>
								<span className="min-w-0 flex-1">
									<span className="block truncate text-sm font-semibold">
										{terminalWorkspaceEntryTitle(entry)}
									</span>
									<span className="block truncate font-mono text-[10px] text-muted-foreground">
										{entry.projectName ?? entry.groupLabel}
									</span>
								</span>
								<span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
									{terminalWorkspaceStatusText(entry)}
								</span>
							</button>
						))}
					</div>
				</div>
			)}

			<div className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4">
				<Button onClick={onNewShell} className="justify-start">
					<Plus className="size-4" /> Novo shell
				</Button>
				<Button variant="outline" onClick={onNewConversation} className="justify-start">
					<Bot className="size-4" /> Nova conversa
				</Button>
			</div>
		</div>
	);
}
