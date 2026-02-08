import { chmod, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptDir, "../..");
const outputDir = join(rootDir, "src-tauri/bin");
const outputPath = join(outputDir, "kowork-backend");

await mkdir(outputDir, { recursive: true });

const result = Bun.spawnSync(
	["bun", "build", "src/server.ts", "--compile", "--outfile", "src-tauri/bin/kowork-backend"],
	{
		cwd: rootDir,
		env: {
			...process.env,
			DATABASE_URL: process.env.DATABASE_URL ?? "/tmp/kowork-build.db",
			JWT_SECRET: process.env.JWT_SECRET ?? "kowork-build-secret",
			NODE_ENV: process.env.NODE_ENV ?? "production",
		},
		stdio: ["ignore", "inherit", "inherit"],
	},
);

if (result.exitCode !== 0) {
	throw new Error("Falha ao compilar backend desktop");
}

await chmod(outputPath, 0o755);

console.log(`Build backend concluido em ${outputPath}`);
