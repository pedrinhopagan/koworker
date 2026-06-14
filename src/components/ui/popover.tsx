import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as React from "react";

import { cn } from "@/lib/utils";

// ============================================================================
// Popover Components
// ============================================================================

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;
const PopoverClose = PopoverPrimitive.Close;

const PopoverContent = React.forwardRef<
	React.ComponentRef<typeof PopoverPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => {
	const [portalContainer, setPortalContainer] = React.useState<HTMLElement | null>(null);

	React.useEffect(() => {
		if (portalContainer) return;
		const themeRoot = document.querySelector<HTMLElement>("[data-theme-root]");
		setPortalContainer(themeRoot);
	}, [portalContainer]);

	return (
		<PopoverPrimitive.Portal container={portalContainer ?? undefined}>
			<PopoverPrimitive.Content
				ref={ref}
				align={align}
				sideOffset={sideOffset}
				className={cn(
					"z-50 border border-border bg-card shadow-xl outline-none",
					"data-[state=open]:animate-in data-[state=closed]:animate-out",
					// Sem fill-mode, ao terminar a animação de saída o elemento volta ao estado base
					// (visível) por um frame antes do Radix desmontá-lo — daí o piscar. `forwards`
					// trava o último frame (já invisível) até o desmonte.
					"data-[state=closed]:fill-mode-forwards",
					"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
					"data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
					"data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
					"data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
					className,
				)}
				{...props}
			/>
		</PopoverPrimitive.Portal>
	);
});
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

// ============================================================================
// Exports
// ============================================================================

export { Popover, PopoverAnchor, PopoverClose, PopoverContent, PopoverTrigger };
