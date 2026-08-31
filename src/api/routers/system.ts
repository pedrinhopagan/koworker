import { ORPCError } from "@orpc/server";

import { protectedProcedure } from "../auth/context";
import { KOWORK_STORAGE_RELEASE } from "@/constants/release";
import {
	browseDirectory,
	openFileInDefaultApp,
	openInFileManager,
	shareZip,
	systemCapabilities,
} from "../helpers/os-actions";
import { resolveLinkTarget } from "../helpers/link-target";
import {
	acquireRedeployLock,
	assertAdminUser,
	failRedeployStart,
	getRedeployStatus,
	releaseRedeployLock,
	spawnRedeployDetached,
} from "../helpers/redeploy";
import { BrowseDirectorySchema, LinkTargetSchema, OsPathSchema } from "../schemas/system";

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

	// O browser (e o Electron, que nega `window.open` fora de http/https) bloqueia navegar para
	// `file://`. Quem abre o arquivo é o backend, que roda na máquina do usuário.
	openPath: protectedProcedure.input(OsPathSchema).handler(async ({ input }) => {
		await openFileInDefaultApp(input.path);
		return { ok: true };
	}),

	resolveLink: protectedProcedure
		.input(LinkTargetSchema)
		.handler(({ input }) => resolveLinkTarget(input)),

	shareZip: protectedProcedure.input(OsPathSchema).handler(({ input }) => shareZip(input.path)),

	redeploy: protectedProcedure
		.errors({ CONFLICT: {}, INTERNAL_SERVER_ERROR: {} })
		.handler(async ({ context }) => {
			assertAdminUser(context.user.user_type);

			await acquireRedeployLock();

			try {
				spawnRedeployDetached();
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				await failRedeployStart(message);
				await releaseRedeployLock();
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
