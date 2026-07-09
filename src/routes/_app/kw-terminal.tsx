import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { SquareTerminal } from "lucide-react";

import { orpc } from "@/client";
import { PageShell } from "@/components/layout/page-shell";
import { Text, Title } from "@/components/typography";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { KW_TERMINAL_PREFIX, KW_TERMINAL_SHORTCUTS } from "@/constants/terminal";
import { KwTerminalWorkspaceCard } from "@/routes/_app/-components/kw-terminal-workspace-card";

export const Route = createFileRoute("/_app/kw-terminal")({
	component: KwTerminalPage,
});

function KwTerminalPage() {
	const overview = useQuery(orpc.kwTerminal.overview.queryOptions());
	const workspaces = overview.data?.workspaces ?? [];

	return (
		<PageShell
			title="kw-terminal"
			description="Atalhos e workspaces do multiplexador kw-terminal"
			icon={SquareTerminal}
			contentClassName="min-h-0 flex-1 overflow-y-auto px-4 pb-8"
		>
			<div className="mx-auto w-full max-w-3xl space-y-8">
				<section className="space-y-3">
					<Title as="div" size="sm">
						Atalhos
					</Title>
					<Text size="xs" tone="muted">
						prefix = <span className="font-mono">{KW_TERMINAL_PREFIX}</span> (modo prefixo estilo
						tmux)
					</Text>
					<ul className="flex flex-col divide-y divide-border border border-border">
						{KW_TERMINAL_SHORTCUTS.map((shortcut) => (
							<li key={shortcut.keys} className="flex items-center gap-4 px-3 py-2">
								<span className="shrink-0 font-mono text-xs text-primary">{shortcut.keys}</span>
								<span className="min-w-0 flex-1 text-right text-sm text-foreground">
									{shortcut.label}
								</span>
							</li>
						))}
					</ul>
				</section>

				<section className="space-y-3">
					<Title as="div" size="sm">
						Workspaces
					</Title>
					{overview.isLoading ? (
						<Text size="sm" tone="muted">
							Carregando...
						</Text>
					) : overview.isError ? (
						<EmptyFeedback
							icon={SquareTerminal}
							title="kw-terminal indisponível"
							subtitle="Não foi possível falar com o servidor kw-terminal desta máquina."
						/>
					) : workspaces.length === 0 ? (
						<EmptyFeedback
							icon={SquareTerminal}
							title="Nenhum workspace aberto"
							subtitle="Abra um workspace no kw-terminal para vê-lo aqui."
						/>
					) : (
						<div className="flex flex-col gap-4">
							{workspaces.map((workspace) => (
								<KwTerminalWorkspaceCard key={workspace.workspace_id} workspace={workspace} />
							))}
						</div>
					)}
				</section>
			</div>
		</PageShell>
	);
}
