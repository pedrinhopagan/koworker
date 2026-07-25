import { ORPCError } from "@orpc/server";

import { protectedProcedure } from "../auth/context";
import { KOWORK_STORAGE_RELEASE } from "@/constants/release";
import {
	browseDirectory,
	openInFileManager,
	shareZip,
	systemCapabilities,
} from "../helpers/os-actions";
import {
	acquireRedeployLock,
	assertAdminUser,
	getRedeployStatus,
	releaseRedeployLock,
	spawnRedeployDetached,
} from "../helpers/redeploy";
import { BrowseDirectorySchema, OsPathSchema } from "../schemas/system";

const CLI_RELEASE_TTL_MS = 60_000;
const CLI_RELEASE_TIMEOUT_MS = 5_000;

let cachedCliRelease: { value: string | null; expiresAt: number } | null = null;
let pendingCliRelease: Promise<string | null> | null = null;

async function spawnCliRelease(): Promise<string | null> {
	const cli = Bun.spawn(["kw-cli", "version", "--json"], {
		stdout: "pipe",
		stderr: "ignore",
	});
	const timeout = setTimeout(() => cli.kill(), CLI_RELEASE_TIMEOUT_MS);

	try {
		const stdout = await new Response(cli.stdout).text();
		await cli.exited;
		if (cli.exitCode !== 0) {
			return null;
		}

		const parsed = JSON.parse(stdout) as { storageRelease?: string };
		return parsed.storageRelease || null;
	} catch {
		return null;
	} finally {
		clearTimeout(timeout);
	}
}

async function readCliRelease(): Promise<string | null> {
	if (cachedCliRelease && cachedCliRelease.expiresAt > Date.now()) {
		return cachedCliRelease.value;
	}

	pendingCliRelease ??= spawnCliRelease()
		.then((value) => {
			cachedCliRelease = { value, expiresAt: Date.now() + CLI_RELEASE_TTL_MS };
			return value;
		})
		.finally(() => {
			pendingCliRelease = null;
		});

	return await pendingCliRelease;
}

export const systemRouter = {
	version: protectedProcedure.handler(async () => {
		const cliRelease = await readCliRelease();

		return {
			storageRelease: KOWORK_STORAGE_RELEASE,
			cliRelease,
			compatible: cliRelease === KOWORK_STORAGE_RELEASE,
		};
	}),

	capabilities: protectedProcedure.handler(() => systemCapabilities()),

	browseDirectory: protectedProcedure
		.input(BrowseDirectorySchema)
		.handler(({ input }) => browseDirectory(input.path ?? "")),

	openFolder: protectedProcedure.input(OsPathSchema).handler(({ input }) => {
		openInFileManager(input.path);
		return { ok: true };
	}),

	shareZip: protectedProcedure.input(OsPathSchema).handler(({ input }) => shareZip(input.path)),

	redeploy: protectedProcedure
		.errors({ CONFLICT: {}, INTERNAL_SERVER_ERROR: {} })
		.handler(async ({ context }) => {
			assertAdminUser(context.user.user_type);

			await acquireRedeployLock();

			try {
				spawnRedeployDetached();
			} catch (error) {
				await releaseRedeployLock();
				const message = error instanceof Error ? error.message : String(error);
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: `Falha ao iniciar redeploy: ${message}`,
				});
			}

			return { started: true };
		}),

	redeployStatus: protectedProcedure.handler(({ context }) => {
		assertAdminUser(context.user.user_type);
		return getRedeployStatus();
	}),
};
