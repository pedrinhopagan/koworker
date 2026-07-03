#!/usr/bin/env bun
import { koworkerDatabasePath } from "@/lib/app-paths";

// A CLI roda no diretório de outro projeto. O Bun auto-carrega o `.env` desse projeto,
// então NÃO confiamos em `DATABASE_URL` herdado — forçamos o DB do koworker (app data
// dir do Tauri, mesmo path que `backend.rs` injeta em produção). `KOWORK_DATABASE_URL`
// permite override explícito. JWT_SECRET é exigido pelo schema mas a CLI não autentica.
process.env.DATABASE_URL = process.env.KOWORK_DATABASE_URL ?? koworkerDatabasePath();
process.env.JWT_SECRET ??= "kowork-cli";

const [command, ...args] = process.argv.slice(2);

const commands: Record<string, (args: string[]) => Promise<void>> = {
	create: async (a) => (await import("./commands/create")).runCreate(a),
	done: async (a) => (await import("./commands/done")).runDone(a),
	task: async (a) => (await import("./commands/task")).runTask(a),
	project: async (a) => (await import("./commands/project")).runProject(a),
	route: async (a) => (await import("./commands/route")).runRoute(a),
	skill: async (a) => (await import("./commands/skill")).runSkill(a),
};

const handler = command ? commands[command] : undefined;

if (!handler) {
	console.log(`kw-cli - CLI

Tarefas:
  create [título] [--type <nome|id>] [--category <nome|id>] [--priority <nome|id>] [--complexity <simples|medio|complexo|extremo>]
                          Cria uma tarefa no projeto do cwd; imprime taskId + pasta (.koworker/<id>)
  task create [título] [...] Alias de create
  task list [busca] [--all|--done|--pending] [--type ...] [--priority ...] [--complexity ...]
                          Lista tarefas do projeto do cwd; use --all-projects para todos
  task show <taskId|caminho>
                          Mostra metadados e arquivos da tarefa
  task set <taskId|caminho> [--title ...] [--type ...] [--priority ...] [--complexity ...] [--done|--pending]
                          Edita metadados de uma tarefa
  task done <taskId|caminho>
  done <taskId|caminho>   Marca a tarefa como concluída
  task reopen <taskId|caminho>
                          Reabre uma tarefa concluída
  task rm <taskId|caminho>
                          Remove a tarefa (soft delete + apaga a pasta)
  task options            Lista complexidades, tipos/categorias e prioridades

Arquivos de tarefa:
  task file list <taskId|caminho>
  task file read <taskId|arquivo.md> [arquivo.md]
  task file create <taskId|arquivo.md> [arquivo.md] [--content ...|--from <path>|--stdin]
  task file write <taskId|arquivo.md> [arquivo.md] [--content ...|--from <path>|--stdin]
  task file rename <taskId|arquivo.md> <old.md> <new.md>
  task file rm <taskId|arquivo.md> [arquivo.md]
  task file reorder <taskId|caminho> <a.md> <b.md> [...]
  task file date <taskId|arquivo.md> [arquivo.md] --edited-at <ISO|epoch-ms>

Projetos e rotas:
  project list            Lista os projetos (id, nome, rota)
  project create <nome> [--route <caminho>] [--color #rrggbb] [--desc ...]
                          Cria um projeto (com rotas padrão); sem --route usa o cwd
  project set <id> [--name ...] [--route ...] [--color ...] [--desc ...]
                          Edita um projeto
  route add <projetoId> <nome> [--command ...] [--icon ...] [--route <caminho>]
                          Adiciona um atalho de terminal ao projeto
  route rm <routeId>      Remove um atalho

Skills:
  skill style <slug> [--label ...] [--icon ...] [--color #rrggbb]
                          Define a aparência de uma skill
  skill list              Lista as skills globais e sua aparência atual
`);
	process.exit(command ? 1 : 0);
}

try {
	await handler(args);
	process.exit(0);
} catch (err: any) {
	console.error(err?.message ?? String(err));
	process.exit(1);
}
