import type { ReactNode } from "react";
import { useId } from "react";
import { Text, Title } from "@/components/typography";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { DialogRoot, DialogTitle } from "./dialog";

type ConfirmDialogProps = {
	open: boolean;
	onClose: () => void;
	onConfirm: () => void;
	title: string;
	description?: string;
	children?: ReactNode;
	confirmLabel?: string;
	cancelLabel?: string;
	variant?: "danger" | "default";
	loading?: boolean;
	confirmDisabled?: boolean;
};

export function ConfirmDialog({
	open,
	onClose,
	onConfirm,
	title,
	description,
	children,
	confirmLabel = "Confirmar",
	cancelLabel = "Cancelar",
	variant = "default",
	loading = false,
	confirmDisabled = false,
}: ConfirmDialogProps) {
	const descriptionId = useId();

	return (
		<DialogRoot
			open={open}
			onClose={onClose}
			role="alertdialog"
			describedBy={description ? descriptionId : undefined}
			className="max-w-md p-6"
		>
			<DialogTitle asChild>
				<Title size="sm" className="mb-2">
					{title}
				</Title>
			</DialogTitle>

			{description && (
				<Text id={descriptionId} size="sm" tone="muted" className={cn(children ? "mb-4" : "mb-6")}>
					{description}
				</Text>
			)}

			{children && <div className="mb-6">{children}</div>}

			<div className="flex justify-end gap-3">
				<Button type="button" variant="outline" onClick={onClose} disabled={loading}>
					{cancelLabel}
				</Button>
				<Button
					type="button"
					variant={variant === "danger" ? "destructive" : "default"}
					onClick={onConfirm}
					disabled={loading || confirmDisabled}
					className={cn(loading && "opacity-70")}
				>
					{loading ? "Aguarde..." : confirmLabel}
				</Button>
			</div>
		</DialogRoot>
	);
}
