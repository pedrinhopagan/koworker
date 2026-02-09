import { useQueryClient } from "@tanstack/react-query";
import { Bug, DatabaseZap } from "lucide-react";
import { type ComponentType, useEffect, useState } from "react";
import { toast } from "sonner";
import { getAppEnv, getAppVersionFallback, isDevelopmentEnvironment } from "@/lib/env";
import { isTauri, openDevtools } from "@/lib/tauri";
import { cn } from "@/lib/utils";

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

	return (
		<footer className="h-8 px-3 border-t border-border/80 bg-muted/20 flex items-center justify-between gap-3 text-xs">
			<div className="min-w-0 flex items-center gap-2">
				<div
					className={cn(
						"px-2 py-0.5 rounded border text-[11px] uppercase tracking-wide bg-muted/25 text-muted-foreground",
						isDev
							? "border-amber-500/20 bg-amber-500/5 text-amber-200/75"
							: "border-emerald-500/20 bg-emerald-500/5 text-emerald-200/75",
					)}
				>
					{appEnv}
				</div>

				<div className="text-muted-foreground/85">v{appVersion}</div>
			</div>

			<div className="flex items-center gap-1 min-w-0">
				<ActionButton onClick={handleOpenConsole} label="Console" icon={Bug} />
				<ActionButton onClick={handleClearCache} label="Limpar Cache" icon={DatabaseZap} />
			</div>
		</footer>
	);
}
