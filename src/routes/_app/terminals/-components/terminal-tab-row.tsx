import { ChevronDown, MoreVertical, Pencil, Target, X } from "lucide-react";
import { useState } from "react";

import { Text } from "@/components/typography";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { commandLabel } from "@/lib/shell-command";
import { cn } from "@/lib/utils";
import type { WorkspaceProjectRef } from "../-utils/resolve-workspace-project";
import type { KwTerminalActions } from "../-utils/use-kw-terminal-actions";
import { FocusOnScreenIndicator } from "./focus-on-screen-indicator";
import { RenameDialog } from "./rename-dialog";
import { TERMINALS_ACTION_BUTTON, TERMINALS_CELL, TERMINALS_COLUMNS } from "./table-layout";
import { WorkspaceMenuItems } from "./workspace-menu-items";

type TerminalTabRowProps = {
	tabId: string;
	label: string;
	focused: boolean;
	workspaceId: string;
	workspaceLabel: string;
	displayName: string;
	project: WorkspaceProjectRef | null;
	actions: KwTerminalActions;
};

export function TerminalTabRow({
	tabId,
	label,
	focused,
	workspaceId,
	workspaceLabel,
	displayName,
	project,
	actions,
}: TerminalTabRowProps) {
	const [renamingTab, setRenamingTab] = useState(false);
	const [renamingWorkspace, setRenamingWorkspace] = useState(false);
	const [closingWorkspace, setClosingWorkspace] = useState(false);
	const [commandOpen, setCommandOpen] = useState(false);
	const program = commandLabel(label);
	const detailed = program !== label;

	return (
		<li className={cn("transition-colors", focused && "bg-primary/5")}>
			<ContextMenu>
				<ContextMenuTrigger asChild>
					<div>
						<div className={cn(TERMINALS_COLUMNS, "relative")}>
							<button
								type="button"
								onClick={function () {
									actions.tabFocus.mutate({ tabId });
								}}
								aria-label={`Focar a tab ${program ?? label}`}
								className="absolute inset-0 cursor-pointer hover:bg-muted/20"
							/>

							<span
								className={cn(
									TERMINALS_CELL,
									"pointer-events-none relative gap-1.5 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-foreground",
								)}
							>
								TERM
								{focused && <FocusOnScreenIndicator variant="item" />}
							</span>

							<span className={cn(TERMINALS_CELL, "pointer-events-none relative")}>
								<Text as="span" size="xs" tone="muted">
									—
								</Text>
							</span>

							<span className={cn(TERMINALS_CELL, "pointer-events-none relative")}>
								<Text as="span" size="xs" tone="muted" className="truncate font-mono">
									{displayName}
									<span className="text-muted-foreground/40"> · </span>
									{program ?? label}
								</Text>
							</span>

							<span className={cn(TERMINALS_CELL, "pointer-events-none relative")}>
								<Text as="span" size="xs" tone="muted">
									—
								</Text>
							</span>

							<span className={cn(TERMINALS_CELL, "pointer-events-none relative")}>
								<Text as="span" size="xs" tone="muted">
									—
								</Text>
							</span>

							<div className={cn(TERMINALS_CELL, "relative z-10 justify-end")}>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<button
											type="button"
											aria-label={`Mais ações da tab ${program ?? label}`}
											className={TERMINALS_ACTION_BUTTON}
										>
											<MoreVertical className="size-3.5" aria-hidden />
										</button>
									</DropdownMenuTrigger>

									<DropdownMenuContent align="end" className="min-w-[220px]">
										<DropdownMenuItem
											onSelect={function () {
												actions.tabFocus.mutate({ tabId });
											}}
										>
											<Target className="size-4" />
											Focar tab
										</DropdownMenuItem>

										<DropdownMenuItem
											onSelect={function () {
												setRenamingTab(true);
											}}
										>
											<Pencil className="size-4" />
											Renomear tab
										</DropdownMenuItem>

										{detailed && (
											<DropdownMenuItem
												onSelect={function () {
													setCommandOpen(true);
												}}
											>
												<ChevronDown className="size-4" />
												Ver comando completo
											</DropdownMenuItem>
										)}

										<DropdownMenuItem
											onSelect={function () {
												actions.tabClose.mutate({ tabId });
											}}
											className="text-destructive"
										>
											<X className="size-4" />
											Fechar tab
										</DropdownMenuItem>

										<DropdownMenuSeparator />

										<WorkspaceMenuItems
											workspaceId={workspaceId}
											displayName={displayName}
											project={project}
											actions={actions}
											Item={DropdownMenuItem}
											Separator={DropdownMenuSeparator}
											onRename={function () {
												setRenamingWorkspace(true);
											}}
											onCloseWorkspace={function () {
												setClosingWorkspace(true);
											}}
										/>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
						</div>

						{commandOpen && detailed && (
							<pre className="max-h-40 overflow-auto overscroll-contain border-t border-border bg-background px-3 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
								{label}
							</pre>
						)}
					</div>
				</ContextMenuTrigger>

				<ContextMenuContent className="min-w-[220px]">
					<ContextMenuItem
						onSelect={function () {
							actions.tabFocus.mutate({ tabId });
						}}
					>
						<Target className="size-4" />
						Focar tab
					</ContextMenuItem>

					<ContextMenuItem
						onSelect={function () {
							setRenamingTab(true);
						}}
					>
						<Pencil className="size-4" />
						Renomear tab
					</ContextMenuItem>

					{detailed && (
						<ContextMenuItem
							onSelect={function () {
								setCommandOpen(true);
							}}
						>
							<ChevronDown className="size-4" />
							Ver comando completo
						</ContextMenuItem>
					)}

					<ContextMenuItem
						onSelect={function () {
							actions.tabClose.mutate({ tabId });
						}}
						className="text-destructive"
					>
						<X className="size-4" />
						Fechar tab
					</ContextMenuItem>

					<ContextMenuSeparator />

					<WorkspaceMenuItems
						workspaceId={workspaceId}
						displayName={displayName}
						project={project}
						actions={actions}
						onRename={function () {
							setRenamingWorkspace(true);
						}}
						onCloseWorkspace={function () {
							setClosingWorkspace(true);
						}}
					/>
				</ContextMenuContent>
			</ContextMenu>

			<RenameDialog
				open={renamingTab}
				title="Renomear tab"
				initial={label}
				pending={actions.tabRename.isPending}
				onClose={function () {
					setRenamingTab(false);
				}}
				onSubmit={function (next) {
					actions.tabRename.mutate(
						{ tabId, label: next },
						{
							onSuccess: function () {
								setRenamingTab(false);
							},
						},
					);
				}}
			/>

			<RenameDialog
				open={renamingWorkspace}
				title="Renomear workspace"
				initial={workspaceLabel}
				pending={actions.workspaceRename.isPending}
				onClose={function () {
					setRenamingWorkspace(false);
				}}
				onSubmit={function (next) {
					actions.workspaceRename.mutate(
						{ workspaceId, label: next },
						{
							onSuccess: function () {
								setRenamingWorkspace(false);
							},
						},
					);
				}}
			/>

			<ConfirmDialog
				open={closingWorkspace}
				onClose={function () {
					setClosingWorkspace(false);
				}}
				onConfirm={function () {
					actions.workspaceClose.mutate(
						{ workspaceId },
						{
							onSuccess: function () {
								setClosingWorkspace(false);
							},
						},
					);
				}}
				title={`Fechar ${displayName}?`}
				description="Todas as tabs e agents deste workspace são encerrados."
				confirmLabel="Fechar"
				variant="danger"
				loading={actions.workspaceClose.isPending}
			/>
		</li>
	);
}
