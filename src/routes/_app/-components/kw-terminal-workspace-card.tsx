import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Plus, Target, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { orpc, type RouterOutputs } from "@/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";

type KwTerminalWorkspace = RouterOutputs["kwTerminal"]["overview"]["workspaces"][number];
type KwTerminalTab = KwTerminalWorkspace["tabs"][number];

function useKwTerminalActions() {
	const queryClient = useQueryClient();
	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: orpc.kwTerminal.overview.key() });
	const onError = (error: Error) => toast.error(`Falha no kw-terminal: ${error.message}`);

	return {
		workspaceFocus: useMutation({
			...orpc.kwTerminal.workspaceFocus.mutationOptions(),
			onSuccess: invalidate,
			onError,
		}),
		workspaceRename: useMutation({
			...orpc.kwTerminal.workspaceRename.mutationOptions(),
			onSuccess: invalidate,
			onError,
		}),
		tabCreate: useMutation({
			...orpc.kwTerminal.tabCreate.mutationOptions(),
			onSuccess: invalidate,
			onError,
		}),
		tabFocus: useMutation({
			...orpc.kwTerminal.tabFocus.mutationOptions(),
			onSuccess: invalidate,
			onError,
		}),
		tabRename: useMutation({
			...orpc.kwTerminal.tabRename.mutationOptions(),
			onSuccess: invalidate,
			onError,
		}),
		tabClose: useMutation({
			...orpc.kwTerminal.tabClose.mutationOptions(),
			onSuccess: invalidate,
			onError,
		}),
	};
}

function RenameField({
	initial,
	onSubmit,
	onCancel,
	pending,
}: {
	initial: string;
	onSubmit: (label: string) => void;
	onCancel: () => void;
	pending: boolean;
}) {
	const [draft, setDraft] = useState(initial);

	function submit() {
		const label = draft.trim();
		if (!label) {
			return;
		}
		onSubmit(label);
	}

	return (
		<div className="flex flex-1 items-center gap-1">
			<Input
				autoFocus
				value={draft}
				onChange={(event) => setDraft(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						submit();
					}

					if (event.key === "Escape") {
						onCancel();
					}
				}}
				disabled={pending}
				className="h-8 flex-1"
			/>
			<Button size="icon-sm" variant="ghost" onClick={submit} disabled={pending || !draft.trim()}>
				<Check className="size-4" />
			</Button>
			<Button size="icon-sm" variant="ghost" onClick={onCancel} disabled={pending}>
				<X className="size-4" />
			</Button>
		</div>
	);
}

function TabRow({
	tab,
	actions,
}: {
	tab: KwTerminalTab;
	actions: ReturnType<typeof useKwTerminalActions>;
}) {
	const [editing, setEditing] = useState(false);

	return (
		<li className="flex items-center gap-2 border border-border bg-card px-3 py-1.5">
			{editing ? (
				<RenameField
					initial={tab.label}
					pending={actions.tabRename.isPending}
					onCancel={() => setEditing(false)}
					onSubmit={(label) =>
						actions.tabRename.mutate(
							{ tabId: tab.tab_id, label },
							{ onSuccess: () => setEditing(false) },
						)
					}
				/>
			) : (
				<>
					<span className="min-w-0 flex-1 truncate text-sm text-foreground">{tab.label}</span>
					{tab.focused && (
						<Badge variant="success" className="shrink-0">
							foco
						</Badge>
					)}
					<Tooltip label="Focar tab">
						<Button
							size="icon-sm"
							variant="ghost"
							onClick={() => actions.tabFocus.mutate({ tabId: tab.tab_id })}
						>
							<Target className="size-4" />
						</Button>
					</Tooltip>
					<Tooltip label="Renomear tab">
						<Button size="icon-sm" variant="ghost" onClick={() => setEditing(true)}>
							<Pencil className="size-4" />
						</Button>
					</Tooltip>
					<Tooltip label="Fechar tab">
						<Button
							size="icon-sm"
							variant="ghost"
							onClick={() => actions.tabClose.mutate({ tabId: tab.tab_id })}
						>
							<X className="size-4" />
						</Button>
					</Tooltip>
				</>
			)}
		</li>
	);
}

export function KwTerminalWorkspaceCard({ workspace }: { workspace: KwTerminalWorkspace }) {
	const actions = useKwTerminalActions();
	const [editing, setEditing] = useState(false);

	return (
		<section className="border border-border bg-background">
			<header className="flex items-center gap-2 border-b border-border px-3 py-2">
				{editing ? (
					<RenameField
						initial={workspace.label}
						pending={actions.workspaceRename.isPending}
						onCancel={() => setEditing(false)}
						onSubmit={(label) =>
							actions.workspaceRename.mutate(
								{ workspaceId: workspace.workspace_id, label },
								{ onSuccess: () => setEditing(false) },
							)
						}
					/>
				) : (
					<>
						<span className="shrink-0 font-mono text-xs text-muted-foreground">
							{workspace.number}
						</span>
						<span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
							{workspace.label}
						</span>
						{workspace.focused && (
							<Badge variant="success" className="shrink-0">
								foco
							</Badge>
						)}
						<Tooltip label="Focar workspace">
							<Button
								size="icon-sm"
								variant="ghost"
								onClick={() =>
									actions.workspaceFocus.mutate({ workspaceId: workspace.workspace_id })
								}
							>
								<Target className="size-4" />
							</Button>
						</Tooltip>
						<Tooltip label="Renomear workspace">
							<Button size="icon-sm" variant="ghost" onClick={() => setEditing(true)}>
								<Pencil className="size-4" />
							</Button>
						</Tooltip>
						<Tooltip label="Nova tab">
							<Button
								size="icon-sm"
								variant="ghost"
								disabled={actions.tabCreate.isPending}
								onClick={() => actions.tabCreate.mutate({ workspaceId: workspace.workspace_id })}
							>
								<Plus className="size-4" />
							</Button>
						</Tooltip>
					</>
				)}
			</header>

			<ul className="flex flex-col gap-1 p-2">
				{workspace.tabs.map((tab) => (
					<TabRow key={tab.tab_id} tab={tab} actions={actions} />
				))}
			</ul>
		</section>
	);
}
