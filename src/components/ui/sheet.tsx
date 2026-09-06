import * as SheetPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";

import { useThemeRootContainer } from "@/hooks/use-theme-root";
import { cn } from "@/lib/utils";

const SheetCloseContext = React.createContext<() => void>(() => {});

function Sheet({ onOpenChange, ...props }: SheetPrimitive.DialogProps) {
	return (
		<SheetCloseContext.Provider value={() => onOpenChange?.(false)}>
			<SheetPrimitive.Root onOpenChange={onOpenChange} {...props} />
		</SheetCloseContext.Provider>
	);
}

const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

const sheetOverlayVariants = tv({
	base: "fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fill-mode-forwards data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:duration-300 data-[state=closed]:duration-200 [animation-timing-function:cubic-bezier(0.32,0.72,0,1)]",
});

const sheetContentVariants = tv({
	base: "fixed z-50 flex touch-none flex-col bg-background shadow-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fill-mode-forwards data-[state=open]:duration-300 data-[state=closed]:duration-200 [animation-timing-function:cubic-bezier(0.32,0.72,0,1)]",
	variants: {
		side: {
			top: "inset-x-0 top-0 border-b border-border data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
			bottom:
				"inset-x-0 bottom-[calc(100dvh_-_var(--app-viewport-top,0px)_-_var(--app-viewport-height,100dvh))] max-h-[calc(var(--app-viewport-height,100dvh)_*_0.85)] rounded-t-xl border-t border-border pb-[env(safe-area-inset-bottom)] data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
			left: "inset-y-0 left-0 h-full border-r border-border data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
			right:
				"inset-y-0 right-0 h-full border-l border-border data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
		},
	},
	defaultVariants: {
		side: "right",
	},
});

const CLOSE_DIRECTION = { top: -1, bottom: 1, left: -1, right: 1 } as const;
const DRAG_SLOP_PX = 8;
const CLOSE_RATIO = 0.35;
const FLICK_VELOCITY_PX_MS = 0.5;

type SheetSide = keyof typeof CLOSE_DIRECTION;

type SwipeState = {
	node: HTMLElement;
	id: number;
	x: number;
	y: number;
	startedAt: number;
	active: boolean;
};

function canScrollToward(
	target: Element | null,
	root: HTMLElement,
	vertical: boolean,
	sign: number,
) {
	for (let element = target; element && element !== root; element = element.parentElement) {
		const size = vertical ? element.clientHeight : element.clientWidth;
		const extent = vertical ? element.scrollHeight : element.scrollWidth;
		const position = vertical ? element.scrollTop : element.scrollLeft;
		if (extent > size && (sign > 0 ? position > 0 : position < extent - size)) return true;
	}
	return false;
}

function useSwipeToClose(side: SheetSide) {
	const close = React.useContext(SheetCloseContext);
	const swipe = React.useRef<SwipeState | null>(null);
	const vertical = side === "top" || side === "bottom";
	const sign = CLOSE_DIRECTION[side];

	function distance(event: React.PointerEvent<HTMLElement>, from: SwipeState) {
		return (vertical ? event.clientY - from.y : event.clientX - from.x) * sign;
	}

	function release(keepOffset: boolean) {
		const current = swipe.current;
		swipe.current = null;
		if (!current || keepOffset) return;
		current.node.style.transition = "";
		current.node.style.transform = "";
	}

	return {
		onPointerDown(event: React.PointerEvent<HTMLElement>) {
			if (event.pointerType !== "touch") return;
			swipe.current = {
				node: event.currentTarget,
				id: event.pointerId,
				x: event.clientX,
				y: event.clientY,
				startedAt: Date.now(),
				active: false,
			};
		},
		onPointerMove(event: React.PointerEvent<HTMLElement>) {
			const current = swipe.current;
			if (!current || event.pointerId !== current.id) return;
			const along = distance(event, current);
			if (!current.active) {
				const across = vertical ? event.clientX - current.x : event.clientY - current.y;
				if (Math.abs(along) < DRAG_SLOP_PX && Math.abs(across) < DRAG_SLOP_PX) return;
				if (
					along <= Math.abs(across) ||
					canScrollToward(event.target as Element, current.node, vertical, sign)
				) {
					swipe.current = null;
					return;
				}
				current.active = true;
				current.node.style.transition = "none";
				try {
					current.node.setPointerCapture(current.id);
				} catch {}
			}
			const offset = Math.max(0, along) * sign;
			current.node.style.transform = vertical
				? `translateY(${offset}px)`
				: `translateX(${offset}px)`;
		},
		onPointerUp(event: React.PointerEvent<HTMLElement>) {
			const current = swipe.current;
			if (!current || event.pointerId !== current.id) return;
			if (!current.active) {
				swipe.current = null;
				return;
			}
			const along = distance(event, current);
			const size = vertical ? current.node.offsetHeight : current.node.offsetWidth;
			const velocity = along / Math.max(1, Date.now() - current.startedAt);
			const shouldClose = along > size * CLOSE_RATIO || velocity > FLICK_VELOCITY_PX_MS;
			release(shouldClose);
			if (shouldClose) close();
		},
		onPointerCancel() {
			release(false);
		},
	};
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
	const swipe = useSwipeToClose(side);

	return (
		<SheetPrimitive.Portal container={portalContainer ?? undefined}>
			<SheetOverlay />
			<SheetPrimitive.Content
				ref={ref}
				data-side={side}
				className={cn(sheetContentVariants({ side }), className)}
				{...props}
				{...swipe}
			>
				{side === "bottom" && (
					<div className="flex shrink-0 justify-center pt-2 pb-1">
						<div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
					</div>
				)}
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
