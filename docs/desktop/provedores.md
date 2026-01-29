# Provedores de SDK

## Objetivo

Centralizar a escolha do SDK com um unico campo `provedorId`.

## Interface comum

Todos os provedores implementam os mesmos metodos:

- `iniciar(entrada)`
- `cancelar(execucaoId)`
- `eventos(execucaoId)`

## Provedores suportados

- `mock`
- `opencode`
- `codex`
- `claude`

## Exemplo de configuracao

```json
{
  "provedorId": "opencode",
  "terminal": {
    "presetId": "auto",
    "tmux": {
      "sessao": "kowork",
      "autoCriar": true
    }
  }
}
```

## Regras

- O core decide qual adapter usar a partir de `provedorId`
- O resto da aplicacao nao conhece o SDK direto
- Erros de inicializacao devem ser expostos como eventos
