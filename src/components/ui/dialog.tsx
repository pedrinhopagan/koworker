import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useId } from "react";

import { Text, Title } from "@/components/typography";
import { useThemeRootContainer } from "@/hooks/use-theme-root";
import { cn } from "@/lib/utils";
import { Button } from "./button";

type DialogRootProps = {
	open: boolean;
	onClose: () => void;
	children: React.ReactNode;
	role?: "dialog" | "alertdialog";
	describedBy?: string;
	className?: string;
};

export function DialogRoot({
	open,
	onClose,
	children,
	role = "dialog",
	describedBy,
	className,
}: DialogRootProps) {
	const container = useThemeRootContainer();

	return (
		<DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
			<DialogPrimitive.Portal container={container ?? undefined}>
				<DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:fill-mode-forwards" />
				<DialogPrimitive.Content
					role={role}
					aria-describedby={describedBy}
					className={cn(
						"fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col border border-border bg-background shadow-2xl outline-none",
						"data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:duration-150",
						"data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:fill-mode-forwards",
						className,
					)}
				>
					{children}
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	);
}

type DialogProps = {
	open: boolean;
	onClose: () => void;
	title: string;
	description?: string;
	children: React.ReactNode;
	footer?: React.ReactNode;
	className?: string;
};

export function Dialog({
	open,
	onClose,
	title,
	description,
	children,
	footer,
	className,
}: DialogProps) {
	const descriptionId = useId();

	return (
		<DialogRoot
			open={open}
			onClose={onClose}
			className={className}
			describedBy={description ? descriptionId : undefined}
		>
			<div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
				<div className="min-w-0">
					<DialogPrimitive.Title asChild>
						<Title as="h2" size="sm" className="uppercase tracking-[0.12em]">
							{title}
						</Title>
					</DialogPrimitive.Title>
					{description && (
						<Text id={descriptionId} size="xs" tone="muted" className="mt-0.5 truncate">
							{description}
						</Text>
					)}
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

			{footer && (
				<div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>
			)}

			<DialogPrimitive.Close asChild>
				<Button variant="ghost" size="icon" className="absolute top-3 right-4 h-8 w-8 shrink-0">
					<X className="h-4 w-4" />
					<span className="sr-only">Fechar</span>
				</Button>
			</DialogPrimitive.Close>
		</DialogRoot>
	);
}

export const DialogTitle = DialogPrimitive.Title;
