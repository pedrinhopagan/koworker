import { useQueryClient } from "@tanstack/react-query";
import {
	Bug,
	ChevronDown,
	DatabaseZap,
	Ellipsis,
	FolderKanban,
	SquareTerminal,
} from "lucide-react";
import { type ComponentType, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { INVOKE_CLI_OPTIONS, type InvokeCli } from "@/constants/invoke";
import { useProjectFocus } from "@/hooks";
import { useProjectSelectDialogStore } from "@/hooks/use-project-select-dialog";
import { getAppEnv, getAppVersionFallback, isDevelopmentEnvironment } from "@/lib/env";
import { isTauri, openDevtools } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { usePromptBarStore } from "@/stores/prompt-bar";

type ActionButtonProps = {
	onClick: () => void | Promise<void>;
	label: string;
	icon: ComponentType<{ size?: number; className?: string }>;
	disabled?: boolean;
};

function ActionButton({ onClick, label, icon: Icon, disabled }: ActionButtonProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className="h-6 px-2 inline-flex items-center gap-1 text-[11px] border border-border/70 bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors disabled:opacity-40"
		>
			<Icon size={12} />
			{label}
		</button>
	);
}

export function StatusBar() {
	const queryClient = useQueryClient();
	const [appVersion, setAppVersion] = useState(getAppVersionFallback());
	const appEnv = getAppEnv();
	const isDev = isDevelopmentEnvironment();
	const cli = usePromptBarStore((s) => s.cli);
	const setCli = usePromptBarStore((s) => s.setCli);

	useEffect(() => {
		let active = true;

		if (!isTauri()) {
			return () => {
				active = false;
			};
		}

		(async () => {
			try {
				const { getVersion } = await import("@tauri-apps/api/app");
				const resolvedVersion = await getVersion();
				if (active) {
					setAppVersion(resolvedVersion);
				}
			} catch {
				if (active) {
					setAppVersion(getAppVersionFallback());
				}
			}
		})();

		return () => {
			active = false;
		};
	}, []);

	async function handleOpenConsole() {
		if (!isTauri()) {
			toast.info("No navegador, use F12 para abrir o console");
			return;
		}

		const opened = await openDevtools();
		if (!opened) {
			toast.error("Nao foi possivel abrir o console");
		}
	}

	function handleClearCache() {
		queryClient.clear();
		toast.success("Cache limpo, recarregando...");
		setTimeout(() => {
			window.location.reload();
		}, 120);
	}

	const cliOptions = INVOKE_CLI_OPTIONS.map((option) => ({
		id: option.value,
		label: option.label,
		hint: option.hint,
	}));

	return (
		<footer className="flex h-9 items-center justify-between gap-2 border-t border-border/80 bg-chrome px-3 text-xs md:h-8 md:gap-3 md:px-3">
			<div className="min-w-0 flex items-center gap-2 truncate">
				<div
					className={cn(
						"shrink-0 px-2 py-0.5 rounded border text-[11px] uppercase tracking-wide bg-muted/25 text-muted-foreground",
						isDev
							? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-200/75"
							: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/5 dark:text-emerald-200/75",
					)}
				>
					{appEnv}
				</div>

				<div className="truncate text-muted-foreground/85">v{appVersion}</div>
			</div>

			<div className="hidden md:flex items-center gap-1 min-w-0">
				<ProjectSelectTrigger />
				<CliSelect />
				<ActionButton onClick={handleOpenConsole} label="Console" icon={Bug} />
				<ActionButton onClick={handleClearCache} label="Limpar Cache" icon={DatabaseZap} />
			</div>

			<div className="md:hidden shrink-0">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="size-8"
							aria-label="Mais opções da barra de status"
						>
							<Ellipsis size={14} />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="min-w-[200px]">
						<DropdownMenuLabel>CLI de trabalho</DropdownMenuLabel>
						{cliOptions.map((option) => (
							<DropdownMenuItem
								key={option.id}
								onClick={() => setCli(option.id as InvokeCli)}
								className={cn(option.id === cli && "font-medium text-foreground")}
							>
								<SquareTerminal size={14} />
								<div className="flex flex-col">
									<span className="text-xs">{option.label}</span>
									<span className="text-[11px] text-muted-foreground">{option.hint}</span>
								</div>
							</DropdownMenuItem>
						))}

						<DropdownMenuSeparator />

						<DropdownMenuItem onClick={handleOpenConsole}>
							<Bug size={14} />
							Console
						</DropdownMenuItem>

						<DropdownMenuItem onClick={handleClearCache}>
							<DatabaseZap size={14} />
							Limpar Cache
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</footer>
	);
}

function ProjectSelectTrigger() {
	const openDialog = useProjectSelectDialogStore((s) => s.openDialog);
	const { selectedProjectId, selectedProject, accent, loading } = useProjectFocus();

	const label =
		selectedProjectId === undefined
			? "Todos os projetos"
			: (selectedProject?.name ?? (loading ? "Carregando..." : "Selecionar projeto"));
	const accentColor = accent?.color ?? null;

	return (
		<Tooltip label="Alt+P">
			<button
				type="button"
				onClick={openDialog}
				className="inline-flex h-6 max-w-[180px] items-center gap-1 border border-border/70 bg-muted/40 px-2 text-[11px] text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
				style={accent ? { borderColor: accent.border } : undefined}
			>
				{accentColor ? (
					<span className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: accentColor }} />
				) : (
					<FolderKanban size={12} className="shrink-0" />
				)}
				<span className="truncate text-left">{label}</span>
				<ChevronDown size={12} className="shrink-0 opacity-50" />
			</button>
		</Tooltip>
	);
}

function CliSelect() {
	const cli = usePromptBarStore((s) => s.cli);
	const setCli = usePromptBarStore((s) => s.setCli);

	const items = INVOKE_CLI_OPTIONS.map((option) => ({
		id: option.value,
		label: option.label,
		hint: option.hint,
	}));
	const active = items.find((option) => option.id === cli);

	return (
		<Tooltip label={active?.hint ?? ""}>
			<CustomSelect
				items={items}
				value={cli}
				onValueChange={(next) => setCli(next as InvokeCli)}
				size="sm"
				fitContent
				triggerClassName="h-6 gap-1 border-border/70 bg-muted/40 px-2 text-[11px] text-muted-foreground hover:bg-muted/70 hover:text-foreground"
				renderTrigger={() => (
					<>
						<SquareTerminal size={12} className="shrink-0" />
						<span className="truncate text-left">{active?.label ?? ""}</span>
						<ChevronDown size={12} className="shrink-0 opacity-50" />
					</>
				)}
				renderItem={(option) => (
					<div className="flex flex-col">
						<span className="text-xs font-medium">{option.label}</span>
						<span className="text-[11px] text-muted-foreground">{option.hint}</span>
					</div>
				)}
			/>
		</Tooltip>
	);
}
