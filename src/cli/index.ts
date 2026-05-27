#!/usr/bin/env bun
import { homedir } from "node:os";
import { join } from "node:path";

// A CLI roda no diretório de outro projeto. O Bun auto-carrega o `.env` desse projeto,
// então NÃO confiamos em `DATABASE_URL` herdado — forçamos o DB do koworker (app data
// dir do Tauri, mesmo path que `backend.rs` injeta em produção). `KOWORK_DATABASE_URL`
// permite override explícito. JWT_SECRET é exigido pelo schema mas a CLI não autentica.
process.env.DATABASE_URL =
	process.env.KOWORK_DATABASE_URL ?? join(homedir(), ".local/share/com.pedro.kowork/kowork.db");
process.env.JWT_SECRET ??= "kowork-cli";

const [command, ...args] = process.argv.slice(2);

if (command === "create") {
	const { runCreate } = await import("./commands/create");
	await runCreate(args);
	process.exit(0);
}

if (command === "done") {
	const { runDone } = await import("./commands/done");
	await runDone(args);
	process.exit(0);
}

console.log(`kowork - CLI

Comandos:
  create "<título>"   Cria uma tarefa no projeto do cwd e imprime a pasta (.koworker/<id>)
  done <caminho>      Marca a tarefa (pasta .koworker/...) como concluída
`);
process.exit(command ? 1 : 0);
