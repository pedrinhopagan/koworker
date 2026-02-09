#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { createTask } from "./commands/create-task";
import { readTask } from "./commands/read-task";
import { updateTask } from "./commands/update-task";

const { positionals } = parseArgs({
	args: Bun.argv.slice(2),
	allowPositionals: true,
});

const [command, ...args] = positionals;

const commands: Record<string, (args: string[]) => Promise<void>> = {
	"create-task": createTask,
	"read-task": readTask,
	"update-task": updateTask,
};

if (!command || command === "help") {
	console.log(`kowork - CLI para atualização de tasks

Comandos:
  create-task <json>    Cria task com JSON completo
  read-task <json>      Le task completa do DB (JSON output)
  update-task <json>    Atualiza task com JSON completo
  help                  Mostra esta mensagem

Uso:
  kowork create-task '{"title": "...", "projectName": "Kowork", "categoryName": "feature", "priorityName": "Media"}'
  kowork read-task '{"taskId": "..."}'
  kowork update-task '{"taskId": "...", "status": "executed"}'
`);
	process.exit(0);
}

const handler = commands[command];
if (!handler) {
	console.error(`Erro: comando "${command}" não encontrado`);
	process.exit(1);
}

try {
	await handler(args);
} catch (err) {
	console.error(`Erro: ${err instanceof Error ? err.message : String(err)}`);
	process.exit(1);
}
