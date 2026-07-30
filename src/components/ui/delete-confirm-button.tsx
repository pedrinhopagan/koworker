import { Check, Trash2 } from "lucide-react";
import { type MouseEvent, useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import { Button, type ButtonProps } from "./button";
import { Tooltip } from "./tooltip";

export function resolveDeleteConfirmationClick(confirming: boolean) {
	if (confirming) {
		return {
			confirming: false,
			shouldDelete: true,
		};
	}

	return {
		confirming: true,
		shouldDelete: false,
	};
}

type DeleteConfirmButtonSize = "default" | "xs";

export function resolveDeleteConfirmButtonSize(sizeVariant: DeleteConfirmButtonSize) {
	if (sizeVariant === "xs") {
		return {
			buttonSize: "icon-sm" as const,
			iconClassName: "size-4 md:size-3",
			buttonClassName: "size-12 p-0 md:size-6",
		};
	}

	return {
		buttonSize: "icon" as const,
		iconClassName: "h-4 w-4",
	};
}

type DeleteConfirmButtonProps = {
	onDelete: () => void;
	disabled?: boolean;
	className?: string;
	title?: string;
	confirmTitle?: string;
	size?: ButtonProps["size"];
	sizeVariant?: DeleteConfirmButtonSize;
};

export function DeleteConfirmButton({
	onDelete,
	disabled,
	className,
	title = "Remover",
	confirmTitle = "Confirmar remoção",
	size,
	sizeVariant = "default",
}: DeleteConfirmButtonProps) {
	const [confirming, setConfirming] = useState(false);
	const resolvedSize = resolveDeleteConfirmButtonSize(sizeVariant);
	const buttonSize = size ?? resolvedSize.buttonSize;

	useEffect(() => {
		if (disabled) {
			setConfirming(false);
		}
	}, [disabled]);

	function handleClick(event: MouseEvent<HTMLButtonElement>) {
		event.preventDefault();
		event.stopPropagation();

		if (disabled) {
			return;
		}

		const next = resolveDeleteConfirmationClick(confirming);
		setConfirming(next.confirming);

		if (next.shouldDelete) {
			onDelete();
		}
	}

	return (
		<Tooltip label={confirming ? confirmTitle : title}>
			<Button
				type="button"
				variant="ghost"
				size={buttonSize}
				disabled={disabled}
				onClick={handleClick}
				aria-label={confirming ? confirmTitle : title}
				className={cn(
					"text-destructive hover:bg-destructive/10 hover:text-destructive",
					confirming && "bg-destructive/10",
					resolvedSize.buttonClassName,
					className,
				)}
			>
				{confirming ? (
					<Check className={resolvedSize.iconClassName} />
				) : (
					<Trash2 className={resolvedSize.iconClassName} />
				)}
			</Button>
		</Tooltip>
	);
}
