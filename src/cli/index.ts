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
  create [título] [--category <nome|id>] [--priority <nome|id>] [--complexity <simples|medio|complexo|extremo>]
                          Cria uma tarefa no projeto do cwd; imprime taskId + a pasta (.koworker/<id>)
  task set <taskId|caminho> [--title ...] [--category ...] [--priority ...] [--complexity ...]
                          Edita metadados de uma tarefa
  done <taskId|caminho>   Marca a tarefa como concluída
  task rm <taskId|caminho>
                          Remove a tarefa (soft delete + apaga a pasta)

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
