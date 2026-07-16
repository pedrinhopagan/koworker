import { X } from "lucide-react";
import { useEffect } from "react";

import { Text, Title } from "@/components/typography";
import { cn } from "@/lib/utils";
import { Button } from "./button";

type DialogProps = {
	open: boolean;
	onClose: () => void;
	title: string;
	description?: string;
	children: React.ReactNode;
	footer?: React.ReactNode;
	className?: string;
	keepMounted?: boolean;
};

export function Dialog({
	open,
	onClose,
	title,
	description,
	children,
	footer,
	className,
	keepMounted = false,
}: DialogProps) {
	useEffect(() => {
		if (!open) return;
		function onKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [open, onClose]);

	if (!open && !keepMounted) return null;

	return (
		<div
			aria-hidden={!open}
			className={cn(
				"fixed inset-0 z-50 flex items-center justify-center p-4",
				!open && "invisible pointer-events-none",
			)}
		>
			<button
				type="button"
				aria-label="Fechar"
				onClick={onClose}
				className={cn("absolute inset-0 bg-black/60", open && "animate-in fade-in-0")}
			/>
			<div
				role="dialog"
				aria-modal="true"
				className={cn(
					"relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col border border-border bg-background shadow-2xl",
					open && "animate-in fade-in-0 zoom-in-95 duration-150",
					className,
				)}
			>
				<div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
					<div className="min-w-0">
						<Title as="h2" size="sm" className="uppercase tracking-[0.12em]">
							{title}
						</Title>
						{description && (
							<Text size="xs" tone="muted" className="mt-0.5 truncate">
								{description}
							</Text>
						)}
					</div>
					<Button
						variant="ghost"
						size="icon"
						onClick={onClose}
						className="-mr-1 -mt-1 h-8 w-8 shrink-0"
					>
						<X className="h-4 w-4" />
					</Button>
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

				{footer && (
					<div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>
				)}
			</div>
		</div>
	);
}
