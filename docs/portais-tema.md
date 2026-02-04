# Portais e tema

Quando um componente de lib usa Portal (Radix, Floating UI, etc), o conteudo costuma ir para `document.body`. No Kowork, as variaveis de tema vivem em `[data-theme-root]`. Fora desse container, `var(--card)` e similares ficam vazias e o background pode ficar transparente.

Como corrigir:
1. Renderize o Portal dentro de `[data-theme-root]` usando a prop `container`.
2. Se a lib nao respeitar classes de fundo, aplique `style` com `backgroundColor` e `color` usando as variaveis do tema.

Exemplos no projeto:
`src/components/ui/custom-select.tsx`
`src/components/ui/dropdown-menu.tsx`
`src/components/ui/popover.tsx`

Exemplo (Radix):

```tsx
const [portalContainer, setPortalContainer] = React.useState<HTMLElement | null>(null);

React.useEffect(() => {
	if (portalContainer) return;
	const themeRoot = document.querySelector<HTMLElement>("[data-theme-root]");
	setPortalContainer(themeRoot);
}, [portalContainer]);

return (
	<PopoverPrimitive.Portal container={portalContainer ?? undefined}>
		<PopoverPrimitive.Content
			style={{
				backgroundColor: "var(--card)",
				color: "var(--card-foreground)",
			}}
		/>
	</PopoverPrimitive.Portal>
);
```
