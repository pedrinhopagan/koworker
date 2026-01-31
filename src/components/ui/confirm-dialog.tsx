import { useEffect, useRef } from "react";
import { Text, Title } from "@/components/typography";
import { cn } from "@/lib/utils";
import { Button } from "./button";

type ConfirmDialogProps = {
	open: boolean;
	onClose: () => void;
	onConfirm: () => void;
	title: string;
	description?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	variant?: "danger" | "default";
	loading?: boolean;
};

export function ConfirmDialog({
	open,
	onClose,
	onConfirm,
	title,
	description,
	confirmLabel = "Confirmar",
	cancelLabel = "Cancelar",
	variant = "default",
	loading = false,
}: ConfirmDialogProps) {
	const dialogRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;

		function onKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [open, onClose]);

	useEffect(() => {
		if (open && dialogRef.current) {
			dialogRef.current.focus();
		}
	}, [open]);

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<button
				type="button"
				aria-label="Fechar dialog"
				onClick={onClose}
				className="absolute inset-0 bg-black/50"
			/>

			<div
				ref={dialogRef}
				role="alertdialog"
				aria-modal="true"
				aria-labelledby="confirm-dialog-title"
				aria-describedby={description ? "confirm-dialog-description" : undefined}
				tabIndex={-1}
				className="relative z-10 w-full max-w-md bg-background border border-border shadow-lg p-6 animate-in fade-in-0 zoom-in-95"
			>
				<Title id="confirm-dialog-title" size="sm" className="mb-2">
					{title}
				</Title>

				{description && (
					<Text id="confirm-dialog-description" size="sm" tone="muted" className="mb-6">
						{description}
					</Text>
				)}

				<div className="flex justify-end gap-3">
					<Button type="button" variant="outline" onClick={onClose} disabled={loading}>
						{cancelLabel}
					</Button>
					<Button
						type="button"
						variant={variant === "danger" ? "destructive" : "default"}
						onClick={onConfirm}
						disabled={loading}
						className={cn(loading && "opacity-70")}
					>
						{loading ? "Aguarde..." : confirmLabel}
					</Button>
				</div>
			</div>
		</div>
	);
}
