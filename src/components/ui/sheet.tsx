import * as SheetPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";

import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

const sheetOverlayVariants = tv({
	base: "fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fill-mode-forwards data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:duration-300 data-[state=closed]:duration-200 [animation-timing-function:cubic-bezier(0.32,0.72,0,1)]",
});

const sheetContentVariants = tv({
	base: "fixed z-50 flex flex-col bg-background shadow-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fill-mode-forwards data-[state=open]:duration-300 data-[state=closed]:duration-200 [animation-timing-function:cubic-bezier(0.32,0.72,0,1)]",
	variants: {
		side: {
			top: "inset-x-0 top-0 border-b border-border data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
			bottom:
				"inset-x-0 bottom-0 max-h-[85dvh] rounded-t-xl border-t border-border data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
			left: "inset-y-0 left-0 h-full border-r border-border data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
			right:
				"inset-y-0 right-0 h-full border-l border-border data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
		},
	},
	defaultVariants: {
		side: "right",
	},
});

function useThemeRootContainer() {
	const [portalContainer, setPortalContainer] = React.useState<HTMLElement | null>(null);

	React.useEffect(() => {
		if (portalContainer) return;
		const themeRoot = document.querySelector<HTMLElement>("[data-theme-root]");
		setPortalContainer(themeRoot);
	}, [portalContainer]);

	return portalContainer;
}

const SheetOverlay = React.forwardRef<
	React.ComponentRef<typeof SheetPrimitive.Overlay>,
	React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
	<SheetPrimitive.Overlay ref={ref} className={cn(sheetOverlayVariants(), className)} {...props} />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

type SheetContentProps = React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> &
	VariantProps<typeof sheetContentVariants> & {
		showClose?: boolean;
	};

const SheetContent = React.forwardRef<
	React.ComponentRef<typeof SheetPrimitive.Content>,
	SheetContentProps
>(({ side = "right", className, children, showClose = true, ...props }, ref) => {
	const portalContainer = useThemeRootContainer();

	return (
		<SheetPrimitive.Portal container={portalContainer ?? undefined}>
			<SheetOverlay />
			<SheetPrimitive.Content
				ref={ref}
				className={cn(sheetContentVariants({ side }), className)}
				{...props}
			>
				{children}
				{showClose && (
					<SheetPrimitive.Close className="absolute top-4 right-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none">
						<X className="size-4" />
						<span className="sr-only">Fechar</span>
					</SheetPrimitive.Close>
				)}
			</SheetPrimitive.Content>
		</SheetPrimitive.Portal>
	);
});
SheetContent.displayName = SheetPrimitive.Content.displayName;

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
	return <div className={cn("flex flex-col gap-1.5", className)} {...props} />;
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-2", className)}
			{...props}
		/>
	);
}

const SheetTitle = React.forwardRef<
	React.ComponentRef<typeof SheetPrimitive.Title>,
	React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
	<SheetPrimitive.Title
		ref={ref}
		className={cn("font-semibold text-foreground", className)}
		{...props}
	/>
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
	React.ComponentRef<typeof SheetPrimitive.Description>,
	React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
	<SheetPrimitive.Description
		ref={ref}
		className={cn("text-muted-foreground text-sm", className)}
		{...props}
	/>
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetOverlay,
	SheetPortal,
	SheetTitle,
	SheetTrigger,
};
