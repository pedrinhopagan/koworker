import { existsSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { $ } from "bun";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const envFile = join(root, ".env");
const envExample = join(root, ".env.example");

const log = (msg: string) => console.log(`\u001B[36m[setup]\u001B[0m ${msg}`);
const ok = (msg: string) => console.log(`\u001B[32m  ✓\u001B[0m ${msg}`);
const skip = (msg: string) => console.log(`\u001B[33m  –\u001B[0m ${msg}`);

// 1. .env
log("Verificando .env...");
if (existsSync(envFile)) {
	skip(".env já existe");
} else {
	copyFileSync(envExample, envFile);
	ok("Criado .env a partir de .env.example");
}

// 2. bun install
log("Instalando dependências (bun install)...");
await $`bun install`.cwd(root);
ok("Dependências instaladas");

// 3. DB — importar conexão já cria as tabelas, depois rodar migrações
log("Criando banco de dados e rodando migrações...");
process.env.DATABASE_URL ??= "db.sqlite";
process.env.JWT_SECRET ??= "setup-secret";

const { ensureDbSchema } = await import("../src/api/db/migrate");
ensureDbSchema();
ok("Schema do banco de dados atualizado");

// 4. Seed
log("Rodando seed (usuário admin, categorias, prioridades, skills)...");
try {
	await $`bun run scripts/seed.ts`.cwd(root).env({ ...process.env });
	ok("Seed concluído");
} catch {
	skip("Seed já foi executado anteriormente (dados já existem)");
}

// 5. Build frontend
log("Buildando frontend (dist/)...");
await $`bun run build:web`.cwd(root);
ok("Frontend buildado em dist/");

// 6. Build backend binary
log("Compilando backend (electron/bin/kowork-backend)...");
await $`bun run build:backend`.cwd(root);
ok("Backend compilado");

log("Compilando shell Electron...");
await $`bun run electron:build`.cwd(root);
ok("Shell Electron compilado");

console.log("");
log("\u001B[32mSetup concluído! Rode \u001B[1mbun dev\u001B[0m\u001B[32m para iniciar.\u001B[0m");
