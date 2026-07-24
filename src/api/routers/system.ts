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

export const systemRouter = {
	version: protectedProcedure.handler(() => {
		const cli = Bun.spawnSync(["kw-cli", "version", "--json"], {
			stdout: "pipe",
			stderr: "ignore",
		});
		let cliRelease: string | null = null;
		if (cli.exitCode === 0) {
			try {
				const parsed = JSON.parse(cli.stdout.toString()) as { storageRelease?: string };
				cliRelease = parsed.storageRelease || null;
			} catch {
				cliRelease = null;
			}
		}

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
