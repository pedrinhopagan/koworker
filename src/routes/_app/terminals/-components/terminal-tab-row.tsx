import { ChevronDown, Pencil, Target, Terminal, X } from "lucide-react";
import { useState } from "react";

import { Text } from "@/components/typography";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { commandLabel } from "@/lib/shell-command";
import { cn } from "@/lib/utils";
import type { KwTerminalActions } from "../-utils/use-kw-terminal-actions";
import { RenameDialog } from "./rename-dialog";

type TerminalTabRowProps = {
	tabId: string;
	label: string;
	focused: boolean;
	actions: KwTerminalActions;
};

const ACTION_BUTTON =
	"relative inline-flex size-7 shrink-0 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground";

export function TerminalTabRow({ tabId, label, focused, actions }: TerminalTabRowProps) {
	const [renaming, setRenaming] = useState(false);
	const [open, setOpen] = useState(false);
	const program = commandLabel(label);
	const detailed = program !== label;

	return (
		<li className={cn("bg-card transition-colors", focused && "bg-primary/5")}>
			<ContextMenu>
				<ContextMenuTrigger asChild>
					<div>
						<div className="relative flex items-center gap-2 px-3 py-2">
							<button
								type="button"
								onClick={function () {
									actions.tabFocus.mutate({ tabId });
								}}
								aria-label={`Focar a tab ${program ?? label}`}
								className="absolute inset-0 cursor-pointer hover:bg-muted/20"
							/>

							<Terminal className="relative size-3.5 shrink-0 text-muted-foreground" />

							<Text
								as="span"
								size="xs"
								className="relative shrink-0 font-bold uppercase tracking-[0.1em]"
							>
								Terminal
							</Text>

							<span className="relative min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
								{program ?? label}
							</span>

							<div className="relative z-10 flex items-center gap-0.5">
								{detailed && (
									<Tooltip label={open ? "Ocultar comando" : "Ver comando completo"}>
										<button
											type="button"
											onClick={function () {
												setOpen(function (current) {
													return !current;
												});
											}}
											aria-label={open ? "Ocultar comando" : "Ver comando completo"}
											aria-expanded={open}
											className={ACTION_BUTTON}
										>
											<ChevronDown
												className={cn("size-3.5 transition-transform", open && "rotate-180")}
											/>
										</button>
									</Tooltip>
								)}

								<Tooltip label={focused ? "Na tela" : "Focar tab"}>
									<button
										type="button"
										onClick={function () {
											actions.tabFocus.mutate({ tabId });
										}}
										aria-label={
											focused
												? `Tab ${program ?? label} na tela`
												: `Focar a tab ${program ?? label}`
										}
										className={cn(ACTION_BUTTON, focused && "text-primary hover:text-primary")}
									>
										<Target className="size-3.5" aria-hidden />
									</button>
								</Tooltip>

								<Tooltip label="Renomear">
									<button
										type="button"
										onClick={function () {
											setRenaming(true);
										}}
										aria-label="Renomear tab"
										className={ACTION_BUTTON}
									>
										<Pencil className="size-3.5" aria-hidden />
									</button>
								</Tooltip>

								<Tooltip label="Fechar tab">
									<button
										type="button"
										onClick={function () {
											actions.tabClose.mutate({ tabId });
										}}
										aria-label="Fechar tab"
										className={cn(ACTION_BUTTON, "hover:text-destructive")}
									>
										<X className="size-3.5" aria-hidden />
									</button>
								</Tooltip>
							</div>
						</div>

						{open && detailed && (
							<pre className="max-h-40 overflow-auto overscroll-contain border-t border-border bg-background px-3 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
								{label}
							</pre>
						)}
					</div>
				</ContextMenuTrigger>

				<ContextMenuContent>
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
							setRenaming(true);
						}}
					>
						<Pencil className="size-4" />
						Renomear
					</ContextMenuItem>

					{detailed && (
						<ContextMenuItem
							onSelect={function () {
								setOpen(true);
							}}
						>
							<ChevronDown className="size-4" />
							Ver comando completo
						</ContextMenuItem>
					)}

					<ContextMenuSeparator />

					<ContextMenuItem
						onSelect={function () {
							actions.tabClose.mutate({ tabId });
						}}
						className="text-destructive"
					>
						<X className="size-4" />
						Fechar tab
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenu>

			<RenameDialog
				open={renaming}
				title="Renomear tab"
				initial={label}
				pending={actions.tabRename.isPending}
				onClose={function () {
					setRenaming(false);
				}}
				onSubmit={function (next) {
					actions.tabRename.mutate(
						{ tabId, label: next },
						{
							onSuccess: function () {
								setRenaming(false);
							},
						},
					);
				}}
			/>
		</li>
	);
}
