# COMPONENTS AGENTS

## OBJETIVO

Garantir consistência visual e base de UI.

## REGRAS

- Base UI vem do shadcn (preset Lyra)
- Preset oficial: `bunx --bun shadcn@latest create --preset \"https://ui.shadcn.com/init?base=radix&style=lyra&baseColor=stone&theme=lime&iconLibrary=lucide&font=nunito-sans&menuAccent=subtle&menuColor=default&radius=none&template=vite\" --template vite`
- Componentes shadcn ficam em `src/components/ui/`
- Criar componentes de tipografia `Title` e `Text` em `src/components/typography.tsx`
- Ícones apenas de `lucide-react`
- Evitar componentes com mais de 200 linhas
