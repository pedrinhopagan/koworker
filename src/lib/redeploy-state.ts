import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import { koworkerDataDir } from "@/lib/app-paths";

const RedeployStateSchema = z
	.object({
		state: z.enum(["idle", "running", "succeeded", "failed"]),
		startedAt: z.number().int().nullable(),
		finishedAt: z.number().int().nullable(),
		commit: z.string().nullable(),
		message: z.string().nullable(),
	})
	.strict();

export type RedeployState = z.infer<typeof RedeployStateSchema>;

export function redeployStatePath() {
	return join(koworkerDataDir(), "redeploy-status.json");
}

export async function readRedeployState(): Promise<RedeployState> {
	try {
		return RedeployStateSchema.parse(JSON.parse(await readFile(redeployStatePath(), "utf8")));
	} catch {
		return {
			state: "idle",
			startedAt: null,
			finishedAt: null,
			commit: null,
			message: null,
		};
	}
}

export async function writeRedeployState(state: RedeployState): Promise<void> {
	const validated = RedeployStateSchema.parse(state);
	const path = redeployStatePath();
	const temporaryPath = `${path}.${crypto.randomUUID()}.tmp`;

	await mkdir(koworkerDataDir(), { recursive: true });
	await writeFile(temporaryPath, `${JSON.stringify(validated)}\n`);
	await rename(temporaryPath, path);
}
