import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildProductionIndexHtml } from "./inject-prod-index";
import { buildProductionServiceWorker } from "./inject-prod-sw";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptDir, "../..");
const distDir = join(rootDir, "dist");

function run(command: string[], cwd = rootDir) {
	const result = Bun.spawnSync(command, {
		cwd,
		stdio: ["ignore", "inherit", "inherit"],
	});

	if (result.exitCode !== 0) {
		throw new Error(`Comando falhou: ${command.join(" ")}`);
	}
}

await rm(distDir, { force: true, recursive: true });
await mkdir(distDir, { recursive: true });

run(["bun", "build", "src/main.tsx", "--outdir", "dist", "--target", "browser"]);
run(["bun", "x", "@tailwindcss/cli", "-i", "src/index.css", "-o", "dist/index.css", "--minify"]);

const sourceIndexPath = join(rootDir, "src/index.html");
const sourceIndex = await readFile(sourceIndexPath, "utf8");
const packageJson = JSON.parse(await readFile(join(rootDir, "package.json"), "utf8")) as {
	version?: string;
};
const appVersion = packageJson.version || "0.0.0";
const builtIndex = buildProductionIndexHtml(sourceIndex, appVersion);

await writeFile(join(distDir, "index.html"), builtIndex);
await cp(join(rootDir, "static"), join(distDir, "static"), { recursive: true });

const sourceSwPath = join(rootDir, "static/sw.js");
const sourceSw = await readFile(sourceSwPath, "utf8");
const builtSw = buildProductionServiceWorker(sourceSw, appVersion);
await writeFile(join(distDir, "sw.js"), builtSw);

console.log(`Build web concluido em ${distDir}`);
