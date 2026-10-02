import { AlertCircle, Check, Clock3, RefreshCw, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Text, Title } from "@/components/typography";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

type ConfigCardProps = {
	icon: LucideIcon;
	title: string;
	description: string;
	onClick: () => void;
	className?: string;
	iconClassName?: string;
	disabled?: boolean;
};

export function ConfigCard({
	icon,
	title,
	description,
	onClick,
	className,
	iconClassName,
	disabled,
}: ConfigCardProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={cn(
				"group flex min-h-22 w-full items-start gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-xs sm:p-5",
				"transition-colors duration-200 hover:border-primary/40 hover:bg-muted/40",
				"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
				"disabled:pointer-events-none disabled:opacity-70",
				className,
			)}
		>
			<Icon icon={icon} size="sm" className="mt-0.5 shrink-0" iconClassName={iconClassName} />
			<div className="min-w-0 space-y-1">
				<Title as="h3" size="sm" className="text-sm font-semibold">
					{title}
				</Title>
				<Text size="sm" tone="muted" className="break-words">
					{description}
				</Text>
			</div>
		</button>
	);
}

type UpdateCallChipProps = {
	status: "idle" | "running" | "done" | "error";
	startedAt?: number | null;
	label?: string;
	className?: string;
};

const CHIP_LABELS = {
	idle: "Pronto para atualizar",
	running: "Publicando versão",
	done: "Versão publicada",
	error: "Atualização interrompida",
};

export function UpdateCallChip({ status, startedAt, label, className }: UpdateCallChipProps) {
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		if (status !== "running") {
			return;
		}

		const interval = window.setInterval(() => setNow(Date.now()), 1_000);
		return () => window.clearInterval(interval);
	}, [status]);

	const elapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1_000)) : 0;
	const duration = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
	const StatusIcon =
		status === "done"
			? Check
			: status === "error"
				? AlertCircle
				: status === "running"
					? RefreshCw
					: Clock3;

	return (
		<span
			role="status"
			aria-live="polite"
			className={cn(
				"relative inline-flex min-h-9 max-w-full items-center gap-2 overflow-hidden rounded-md border px-3 py-1.5 text-xs font-medium shadow-xs",
				"border-border bg-background text-muted-foreground",
				status === "running" && "border-primary/40 text-foreground",
				status === "done" && "border-success/40 bg-success/10 text-success",
				status === "error" && "border-destructive/40 bg-destructive/10 text-destructive",
				className,
			)}
		>
			{status === "running" && (
				<span className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-[update-chip-sweep_2.4s_ease-in-out_infinite] bg-primary/10 motion-reduce:hidden" />
			)}
			<StatusIcon
				className={cn(
					"relative size-3.5 shrink-0",
					status === "running" && "animate-spin motion-reduce:animate-none",
				)}
			/>
			<span className="relative border-r border-current/20 pr-2 font-mono text-[11px] font-semibold text-foreground">
				app
			</span>
			<span className="relative truncate">{label ?? CHIP_LABELS[status]}</span>
			{status === "running" && startedAt && (
				<span className="relative border-l border-current/20 pl-2 font-mono tabular-nums text-muted-foreground">
					{duration}
				</span>
			)}
		</span>
	);
}
