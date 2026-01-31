import { X } from "lucide-react";
import { useEffect } from "react";

import { cn } from "@/lib/utils";
import { Button } from "./button";

type DrawerProps = {
	open: boolean;
	onClose: () => void;
	title: string;
	description?: string;
	children: React.ReactNode;
	widthClassName?: string;
};

export function Drawer({
	open,
	onClose,
	title,
	description,
	children,
	widthClassName = "w-[420px]",
}: DrawerProps) {
	useEffect(() => {
		if (!open) return;
		function onKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [open, onClose]);

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50">
			<button
				type="button"
				aria-label="Fechar drawer"
				onClick={onClose}
				className="absolute inset-0 bg-black/40"
			/>

			<div
				role="dialog"
				aria-modal="true"
				className={cn(
					"animate-slide-in-right fixed top-0 right-0 flex h-full flex-col border-l border-border bg-background shadow-xl",
					widthClassName,
				)}
			>
				<div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
					<div className="min-w-0">
						<div className="text-sm font-semibold truncate">{title}</div>
						{description ? (
							<div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
						) : null}
					</div>
					<Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
						<X className="h-4 w-4" />
					</Button>
				</div>

				<div className="flex-1 overflow-y-auto p-4">{children}</div>
			</div>
		</div>
	);
}
