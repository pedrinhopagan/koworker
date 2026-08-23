import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import { koworkerDataDir } from "@/lib/app-paths";

// Carimbo da revisão realmente publicada no disco. O hot-deploy grava depois de o backend novo
// passar no health check; o status de redeploy compara com a revisão esperada para nunca anunciar
// sucesso em cima de uma versão diferente da pedida.
const DeployedRevisionSchema = z
	.object({
		revision: z.string().min(1),
		commit: z.string().min(1),
		builtAt: z.number().int(),
	})
	.strict();

export type DeployedRevision = z.infer<typeof DeployedRevisionSchema>;

export function deployedRevisionPath() {
	return join(koworkerDataDir(), "deployed-revision.json");
}

export async function readDeployedRevision(): Promise<DeployedRevision | null> {
	try {
		return DeployedRevisionSchema.parse(JSON.parse(await readFile(deployedRevisionPath(), "utf8")));
	} catch {
		return null;
	}
}

export async function writeDeployedRevision(revision: DeployedRevision): Promise<void> {
	const validated = DeployedRevisionSchema.parse(revision);
	const path = deployedRevisionPath();
	const temporaryPath = `${path}.${crypto.randomUUID()}.tmp`;

	await mkdir(koworkerDataDir(), { recursive: true });
	await writeFile(temporaryPath, `${JSON.stringify(validated)}\n`);
	await rename(temporaryPath, path);
}
