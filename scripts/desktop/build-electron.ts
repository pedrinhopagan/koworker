import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptDir, "../..");
const outDir = join(rootDir, "electron", "out");

await rm(outDir, { force: true, recursive: true });
await mkdir(outDir, { recursive: true });

const result = await Bun.build({
	entrypoints: [join(rootDir, "electron", "main.ts"), join(rootDir, "electron", "preload.ts")],
	outdir: outDir,
	target: "node",
	format: "cjs",
	external: ["electron"],
	naming: "[name].cjs",
	sourcemap: "linked",
	minify: process.env.NODE_ENV === "production",
});

if (!result.success) {
	for (const log of result.logs) {
		console.error(log);
	}

	throw new Error("Falha ao compilar o processo Electron");
}

console.log(`Build Electron concluído em ${outDir}`);
