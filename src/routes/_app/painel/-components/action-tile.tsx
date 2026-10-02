import { ArrowUpRight, Play, SquareTerminal } from "lucide-react";

import { CliLogo } from "@/components/icons/cli-logos";
import { Text } from "@/components/typography";
import { CallChip } from "@/components/ui/call-chip";
import { resolveProjectRouteCli } from "@/constants/projects";
import type { ProjectActionMode } from "@/constants/project-actions";
import { LucideIcon } from "@/lib/lucide-icon";
import { cn } from "@/lib/utils";
import type { ActionRun, ProjectAction } from "../-utils/use-action-runs";

type ActionTileProps = {
	action: ProjectAction;
	lastRun: ActionRun | undefined;
	canOpenTerminal: boolean;
	onRun: (mode: ProjectActionMode) => void;
	onShowRun: (runId: string) => void;
};

export function ActionTile({
	action,
	lastRun,
	canOpenTerminal,
	onRun,
	onShowRun,
}: ActionTileProps) {
	const running = lastRun?.state.status === "running";
	const cli = action.group === "cli" ? resolveProjectRouteCli({ name: action.label }) : undefined;
	const primary: ProjectActionMode =
		action.mode === "terminal" && !canOpenTerminal && action.command ? "background" : action.mode;
	const alternate = cli || !action.command ? undefined : alternateMode(primary, canOpenTerminal);
	const primaryDisabled =
		(primary === "background" && running) || (primary === "terminal" && !canOpenTerminal);

	return (
		<div className="group/tile flex min-w-0 items-stretch rounded-xl border border-border bg-card transition-colors hover:border-foreground/25">
			<button
				type="button"
				onClick={() => onRun(primary)}
				disabled={primaryDisabled}
				title={action.command}
				className="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:hover:bg-transparent"
			>
				<div className="flex size-9 shrink-0 items-center justify-center border border-border bg-muted/40">
					{cli ? (
						<CliLogo cli={cli} className="size-4" />
					) : (
						<LucideIcon name={action.icon} className="size-4 text-foreground" />
					)}
				</div>
				<div className="min-w-0 flex-1">
					<Text as="div" size="sm" className="truncate font-semibold leading-tight">
						{action.label}
					</Text>
					{action.command && (
						<Text
							as="div"
							size="xs"
							tone="faint"
							className="mt-0.5 truncate font-mono leading-tight"
						>
							{action.command}
						</Text>
					)}
				</div>
				{!lastRun && (
					<ModeGlyph
						mode={primary}
						className="text-muted-foreground opacity-0 group-hover/tile:opacity-100"
					/>
				)}
			</button>
			{lastRun && (
				<button
					type="button"
					onClick={() => onShowRun(lastRun.id)}
					aria-label="Ver saída"
					className="flex cursor-pointer items-center pr-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
				>
					<CallChip state={lastRun.state} />
				</button>
			)}
			{alternate && (
				<button
					type="button"
					onClick={() => onRun(alternate)}
					disabled={alternate === "background" && running}
					aria-label={alternate === "terminal" ? "Abrir no terminal" : "Rodar em background"}
					title={alternate === "terminal" ? "Abrir no terminal" : "Rodar em background"}
					className="flex w-9 shrink-0 cursor-pointer items-center justify-center border-l border-border text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
				>
					{alternate === "terminal" ? (
						<SquareTerminal className="size-3.5" />
					) : (
						<Play className="size-3.5" />
					)}
				</button>
			)}
		</div>
	);
}

function alternateMode(
	primary: ProjectActionMode,
	canOpenTerminal: boolean,
): ProjectActionMode | undefined {
	if (primary === "terminal") return "background";
	if (canOpenTerminal) return "terminal";
	return undefined;
}

function ModeGlyph({ mode, className }: { mode: ProjectActionMode; className?: string }) {
	if (mode === "background") {
		return <Play className={cn("size-3.5 shrink-0 transition-opacity", className)} />;
	}
	return <ArrowUpRight className={cn("size-3.5 shrink-0 transition-opacity", className)} />;
}
