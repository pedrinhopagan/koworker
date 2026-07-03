import { tv } from "tailwind-variants";

import { Drawer } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

export const docSheetAction = tv({
	base: "flex min-h-12 w-full items-center gap-3 px-5 py-3 text-base text-foreground transition-colors hover:bg-muted/30 disabled:pointer-events-none disabled:opacity-50",
});

type DocSheetActionButtonProps = {
	icon: React.ReactNode;
	label: string;
	onClick?: () => void;
	disabled?: boolean;
	className?: string;
	"aria-pressed"?: boolean;
};

export function DocSheetActionButton({
	icon,
	label,
	onClick,
	disabled,
	className,
	"aria-pressed": ariaPressed,
}: DocSheetActionButtonProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-pressed={ariaPressed}
			className={cn(docSheetAction(), className)}
		>
			<span className="flex size-[18px] shrink-0 items-center justify-center">{icon}</span>
			<span className="min-w-0 flex-1 truncate text-left">{label}</span>
		</button>
	);
}

type DocMobileActionsDrawerProps = {
	open: boolean;
	onClose: () => void;
	title?: string;
	children: React.ReactNode;
};

export function DocMobileActionsDrawer({
	open,
	onClose,
	title = "Ações do documento",
	children,
}: DocMobileActionsDrawerProps) {
	return (
		<Drawer open={open} onClose={onClose} side="right" title={title}>
			<nav className="-mx-5 flex flex-col">{children}</nav>
		</Drawer>
	);
}

export function DocSheetDivider() {
	return <div className="my-3 border-t border-border" />;
}
