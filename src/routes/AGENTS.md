# ROUTES AGENTS

## OBJETIVO

Padronizar o uso do TanStack Router e integração com ORPC.

## REGRAS

- Rotas seguem file-based routing
- Exportar `Route` com `createFileRoute`
- Rotas protegidas ficam abaixo de `/_app`
- Dados via `orpc` + `@tanstack/react-query`
- Eventos em tempo real via `orpcWs`

## UI

- Usar `<Title>` e `<Text>` para texto
- Componentes base em `src/components/ui/`
- Condicionais com `&&`
- Ícones apenas de `lucide-react`
