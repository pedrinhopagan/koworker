import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import { Check, ChevronRight, Circle } from "lucide-react";
import * as React from "react";
import { tv } from "tailwind-variants";

import { cn } from "@/lib/utils";

const ContextMenu = ContextMenuPrimitive.Root;

const ContextMenuTrigger = ContextMenuPrimitive.Trigger;

const ContextMenuGroup = ContextMenuPrimitive.Group;

const ContextMenuPortal = ContextMenuPrimitive.Portal;

const ContextMenuSub = ContextMenuPrimitive.Sub;

const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup;

const contextMenuSubTriggerVariants = tv({
	base: "flex cursor-default select-none items-center gap-2 rounded-sm px-3 py-1.5 text-sm outline-none focus:bg-muted focus:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
	variants: {
		inset: {
			true: "pl-8",
		},
	},
});

const ContextMenuSubTrigger = React.forwardRef<
	React.ElementRef<typeof ContextMenuPrimitive.SubTrigger>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubTrigger> & {
		inset?: boolean;
	}
>(({ className, inset, children, ...props }, ref) => (
	<ContextMenuPrimitive.SubTrigger
		ref={ref}
		className={cn(contextMenuSubTriggerVariants({ inset }), className)}
		{...props}
	>
		{children}
		<ChevronRight className="ml-auto" />
	</ContextMenuPrimitive.SubTrigger>
));
ContextMenuSubTrigger.displayName = ContextMenuPrimitive.SubTrigger.displayName;

// z-[110] fica acima do ContextMenuContent (z-[100]): portado pra raiz do tema, o submenu vira
// irmão do menu pai, então precisa pintar por cima na faixa de sobreposição — senão o ponteiro
// cruzando do trigger pro submenu atinge o menu pai e o submenu pisca abrindo/fechando.
const contextMenuSubContentVariants = tv({
	base: "z-[110] min-w-[8rem] overflow-hidden rounded-md border border-border bg-card p-1 text-foreground shadow-xl duration-[80ms] data-[state=open]:animate-in data-[state=open]:fade-in-0",
});

// Portado pra mesma raiz de tema do ContextMenuContent: sem portal, o SubContent renderiza dentro
// do Content (overflow-hidden + transform de animação), que recorta e desloca o submenu — origem do
// piscar no hover. Como irmão na raiz do tema, posiciona livre e herda as variáveis do tema.
const ContextMenuSubContent = React.forwardRef<
	React.ElementRef<typeof ContextMenuPrimitive.SubContent>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubContent>
>(({ className, style, ...props }, ref) => {
	const portalContainer = useThemeRootContainer();

	const contentStyle: React.CSSProperties = {
		backgroundColor: "var(--card)",
		color: "var(--card-foreground)",
		...style,
	};

	return (
		<ContextMenuPrimitive.Portal container={portalContainer ?? undefined}>
			<ContextMenuPrimitive.SubContent
				ref={ref}
				className={cn(contextMenuSubContentVariants(), className)}
				style={contentStyle}
				{...props}
			/>
		</ContextMenuPrimitive.Portal>
	);
});
ContextMenuSubContent.displayName = ContextMenuPrimitive.SubContent.displayName;

// Portal para dentro do [data-theme-root]: o conteúdo do menu vive fora da árvore por padrão,
// onde as variáveis de tema não resolvem (bg transparente, texto preto). Portar pra raiz do tema
// + fixar bg/cor inline garante o mesmo visual dos outros menus em qualquer lugar.
function useThemeRootContainer(): HTMLElement | null {
	const [container, setContainer] = React.useState<HTMLElement | null>(null);

	React.useEffect(() => {
		if (container) return;
		setContainer(document.querySelector<HTMLElement>("[data-theme-root]"));
	}, [container]);

	return container;
}

const contextMenuContentVariants = tv({
	base: "z-[100] min-w-[160px] overflow-hidden rounded-md border border-border bg-card py-1 text-foreground shadow-xl duration-[80ms] data-[state=open]:animate-in data-[state=open]:fade-in-0",
});

const ContextMenuContent = React.forwardRef<
	React.ElementRef<typeof ContextMenuPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(({ className, style, ...props }, ref) => {
	const portalContainer = useThemeRootContainer();

	const contentStyle: React.CSSProperties = {
		backgroundColor: "var(--card)",
		color: "var(--card-foreground)",
		...style,
	};

	return (
		<ContextMenuPrimitive.Portal container={portalContainer ?? undefined}>
			<ContextMenuPrimitive.Content
				ref={ref}
				className={cn(contextMenuContentVariants(), className)}
				style={contentStyle}
				{...props}
			/>
		</ContextMenuPrimitive.Portal>
	);
});
ContextMenuContent.displayName = ContextMenuPrimitive.Content.displayName;

const contextMenuItemVariants = tv({
	base: "relative flex cursor-default select-none items-center gap-2 rounded-sm px-3 py-1.5 text-sm outline-none transition-colors focus:bg-muted focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
	variants: {
		inset: {
			true: "pl-8",
		},
	},
});

const ContextMenuItem = React.forwardRef<
	React.ElementRef<typeof ContextMenuPrimitive.Item>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & {
		inset?: boolean;
	}
>(({ className, inset, ...props }, ref) => (
	<ContextMenuPrimitive.Item
		ref={ref}
		className={cn(contextMenuItemVariants({ inset }), className)}
		{...props}
	/>
));
ContextMenuItem.displayName = ContextMenuPrimitive.Item.displayName;

const contextMenuCheckboxItemVariants = tv({
	base: "relative flex cursor-default select-none items-center gap-2 rounded-sm py-1.5 pr-3 pl-8 text-sm outline-none transition-colors focus:bg-muted focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
});

const ContextMenuCheckboxItem = React.forwardRef<
	React.ElementRef<typeof ContextMenuPrimitive.CheckboxItem>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
	<ContextMenuPrimitive.CheckboxItem
		ref={ref}
		className={cn(contextMenuCheckboxItemVariants(), className)}
		checked={checked}
		{...props}
	>
		<span className="absolute left-2 flex size-3.5 items-center justify-center">
			<ContextMenuPrimitive.ItemIndicator>
				<Check className="size-4" />
			</ContextMenuPrimitive.ItemIndicator>
		</span>
		{children}
	</ContextMenuPrimitive.CheckboxItem>
));
ContextMenuCheckboxItem.displayName = ContextMenuPrimitive.CheckboxItem.displayName;

const contextMenuRadioItemVariants = tv({
	base: "relative flex cursor-default select-none items-center gap-2 rounded-sm py-1.5 pr-3 pl-8 text-sm outline-none transition-colors focus:bg-muted focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
});

const ContextMenuRadioItem = React.forwardRef<
	React.ElementRef<typeof ContextMenuPrimitive.RadioItem>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
	<ContextMenuPrimitive.RadioItem
		ref={ref}
		className={cn(contextMenuRadioItemVariants(), className)}
		{...props}
	>
		<span className="absolute left-2 flex size-3.5 items-center justify-center">
			<ContextMenuPrimitive.ItemIndicator>
				<Circle className="size-2 fill-current" />
			</ContextMenuPrimitive.ItemIndicator>
		</span>
		{children}
	</ContextMenuPrimitive.RadioItem>
));
ContextMenuRadioItem.displayName = ContextMenuPrimitive.RadioItem.displayName;

const contextMenuLabelVariants = tv({
	base: "px-3 py-1.5 text-sm font-semibold text-foreground",
	variants: {
		inset: {
			true: "pl-8",
		},
	},
});

const ContextMenuLabel = React.forwardRef<
	React.ElementRef<typeof ContextMenuPrimitive.Label>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Label> & {
		inset?: boolean;
	}
>(({ className, inset, ...props }, ref) => (
	<ContextMenuPrimitive.Label
		ref={ref}
		className={cn(contextMenuLabelVariants({ inset }), className)}
		{...props}
	/>
));
ContextMenuLabel.displayName = ContextMenuPrimitive.Label.displayName;

const contextMenuSeparatorVariants = tv({
	base: "-mx-1 my-1 h-px bg-border",
});

const ContextMenuSeparator = React.forwardRef<
	React.ElementRef<typeof ContextMenuPrimitive.Separator>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
	<ContextMenuPrimitive.Separator
		ref={ref}
		className={cn(contextMenuSeparatorVariants(), className)}
		{...props}
	/>
));
ContextMenuSeparator.displayName = ContextMenuPrimitive.Separator.displayName;

const contextMenuShortcutVariants = tv({
	base: "ml-auto text-xs tracking-widest text-muted-foreground",
});

const ContextMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
	return <span className={cn(contextMenuShortcutVariants(), className)} {...props} />;
};
ContextMenuShortcut.displayName = "ContextMenuShortcut";

export {
	ContextMenu,
	ContextMenuCheckboxItem,
	ContextMenuContent,
	ContextMenuGroup,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuPortal,
	ContextMenuRadioGroup,
	ContextMenuRadioItem,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
};
