# CLI AGENTS

## OBJETIVO

CLI `kowork` usada por AI Coding Agents. Com o modelo orientado a `.md`, a leitura e a
escrita da tarefa acontecem direto nos arquivos da pasta `.koworker/<id>` — a CLI só cobre
o que não vive no FS: registrar uma tarefa nova no índice (SQLite) e marcá-la como concluída.

## ESTRUTURA

```
cli/
├── index.ts            # Entry point: bootstrap de env + dispatch de comando
└── commands/
    ├── create.ts       # Registra uma tarefa no projeto do cwd e imprime a pasta
    └── done.ts         # Marca a tarefa como done a partir do caminho da pasta
```

## REGRAS

- Acesso ao DB via `dbTasks` (mesma camada da API); sem schema duplicado.
- A CLI roda no cwd de outro projeto, então o entry point define `DATABASE_URL`
  (app data dir do Tauri) antes de importar a camada de DB.
- Erros em pt-BR e exit code != 0.

## COMANDOS

### create

```bash
kowork create "<título da tarefa>"
```

Resolve o projeto cujo `main_route` é exatamente o cwd, gera o id curto e o `folder_path`
(`.koworker/<id8>`), cria a pasta com um `index.md` (`# título`) e insere a tarefa no banco
com a primeira prioridade e categoria (por `display_order`). Imprime o `folder_path` na
última linha pro agente usar. Erro em pt-BR se o cwd não for um projeto registrado.

### done

```bash
kowork done <caminho-da-pasta>
```

Recebe qualquer caminho dentro da pasta da tarefa (absoluto, relativo ou um `.md`
dela), resolve o `folder_path` canônico (`.koworker/<dir>`) e marca a tarefa como
`done`, setando `completed_at`.
