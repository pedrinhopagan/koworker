# CLI AGENTS

## OBJETIVO

CLI `kw-cli` usada por AI Coding Agents. Com o modelo orientado a `.md`, leitura e escrita
acontecem nos arquivos apontados por `tasks.folder_path`. O path pode estar no layout v1 flat
ou no layout v2 por feature; callers tratam `folder_path` como opaco.

## ESTRUTURA

```
cli/
├── index.ts            # Entry point: bootstrap de env + dispatch de comando + help canônico
├── args.ts             # Parser de positionals e flags
├── notify.ts           # Aviso HTTP ao servidor após escrita (best-effort)
├── resolve.ts          # Resolve por cwd + UUID, storage_key ou maior prefixo de folder_path
├── task-storage.ts     # Resolve o projeto da task e delega ao lock de storage da API
└── commands/
    ├── create.ts       # Cria pela mesma boundary de storage da API
    ├── done.ts         # Conclui a tarefa resolvida
    ├── feature.ts      # Lista, busca e cria features (task_groups) com identidade de storage
    ├── storage.ts      # Preview e reconciliação com backup global
    ├── backup.ts       # Backup global de storage
    ├── project.ts      # Lista, cria e edita projetos
    ├── route.ts        # Rotas do projeto
    ├── skill.ts        # Estilo e listagem de skills
    ├── task.ts         # Metadados, conclusão, merge e quarentena
    └── task-file.ts    # Operações de conteúdo sobre path validado
```

## REGRAS

- Acesso ao DB via `dbTasks` (mesma camada da API); sem schema duplicado.
- A CLI roda no cwd de outro projeto, então o entry point define `DATABASE_URL`
  (app data dir do Tauri) antes de importar a camada de DB.
- Erros em pt-BR e exit code != 0.
- Mutations que tocam storage de tarefa (`create`, `done`, `task set/done/reopen/rm/merge-*`,
  `task file *`, `feature create`) rodam sob `withProjectStorageLock` (`api/helpers/task-storage-coordinator.ts`),
  o mesmo caminho da API. `project` e `route` não tocam storage e não pegam lock.
- `withCliTaskStorageLock` só carrega o projeto da task e repassa a linha para o coordinator,
  que revalida `project_id` e `folder_path` depois de entrar na fila.
- Remoção move conteúdo para `.koworker/.backups`; nunca apaga a pasta diretamente.
- `kw-cli version --json` expõe a release de storage instalada.

## COMANDOS

### create

```bash
kw-cli create "<título da tarefa>"
```

Resolve o projeto cujo `main_route` contém o cwd, aloca `storage_key` única e slug congelado,
calcula o path pela versão do projeto, cria `index.md` e insere o registro pela boundary comum.
`--feature` é obrigatório e aceita feature do mesmo projeto. Imprime o `folder_path` na última linha.

### feature

```bash
kw-cli feature list [busca] [--project <id>]
kw-cli feature create "<nome>" [--project <id>]
```

Sem `--project`, resolve o projeto pelo cwd. A criação aloca `storage_key`, congela o
`storage_slug` e preserva a ordem de exibição usada pela aplicação. Nomes ambíguos em
`task create --feature` exigem o id da feature.

### storage

```bash
kw-cli storage preview [--all]
kw-cli storage reconcile [--all]
```

O reconcile calcula todos os planos antes de escrever, exige um backup global concluído e aplica
somente projetos sem bloqueios ou órfãos. Cada projeto é revalidado sob lock e precisa terminar com
preview zerado.

### done

```bash
kw-cli done <caminho-da-pasta>
```

Recebe UUID, `storage_key` ou qualquer caminho dentro da pasta da tarefa. A resolução é
confinada ao projeto do cwd e usa o maior `folder_path` em fronteira de segmento.
