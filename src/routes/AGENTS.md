# ROUTES AGENTS

## OBJETIVO

Padronizar o uso do TanStack Router e integração com ORPC.

## ESTRUTURA

```
routes/
├── __root.tsx           # Layout raiz
├── _app.tsx             # Layout autenticado
├── _app/
│   ├── -components/     # Componentes compartilhados do app
│   ├── index.tsx        # Dashboard
│   ├── tarefas/
│   │   ├── index.tsx
│   │   ├── -components/ # Componentes da página
│   │   └── -utils/      # Hooks específicos
│   ├── projetos/
│   └── agenda/
└── login.tsx
```

## REGRAS

- Rotas seguem file-based routing
- Exportar `Route` com `createFileRoute`
- Rotas protegidas ficam abaixo de `/_app`
- Dados via `orpc` + `@tanstack/react-query`
- Eventos em tempo real via `orpcWs`

## ORGANIZAÇÃO DE ROTA

```
routes/_app/tarefas/
├── index.tsx              # Página principal
├── -components/           # Componentes específicos
│   ├── task-card.tsx
│   └── task-filters/
│       └── index.tsx
└── -utils/                # Hooks específicos
    └── use-tasks-query.ts
```

## UI

- Usar `<Title>` e `<Text>` para texto
- Componentes base em `src/components/ui/`
- Condicionais com `&&`
- Ícones apenas de `lucide-react`

## STATE MANAGEMENT

| Tipo | Ferramenta |
|------|------------|
| Server state | TanStack Query |
| UI/Local state | Zustand |
| Form state | react-hook-form |

## STYLING

Usar `tailwind-variants` para variantes de componentes:

```typescript
const cardVariants = tv({
  base: "rounded-lg",
  variants: {
    variant: { default: "bg-card", outline: "border" },
    size: { sm: "p-3", md: "p-4" }
  }
})
```

## ANTI-PATTERNS

| Proibido | Correto |
|----------|---------|
| `<h1>`, `<p>` | `<Title>`, `<Text>` |
| `? <X /> : null` | `&& <X />` |
| Componente >200 linhas | Extrair para -components/ |
| Ícones de outras libs | `lucide-react` |
| Prop drilling | Fetch no componente que usa |
