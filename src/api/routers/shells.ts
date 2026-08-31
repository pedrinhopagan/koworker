import { ORPCError } from "@orpc/server";
import { stat } from "node:fs/promises";

import { protectedProcedure } from "../auth/context";
import { shellRuntime } from "../helpers/shells/supervisor";
import {
	ShellCreateSchema,
	ShellIdSchema,
	ShellInputSchema,
	ShellRenameSchema,
	ShellResizeSchema,
} from "../schemas";

async function resolveCwd(cwd: string): Promise<string> {
	const resolved = cwd.startsWith("/") ? cwd : `${process.cwd()}/${cwd}`;
	let info;
	try {
		info = await stat(resolved);
	} catch {
		throw new ORPCError("BAD_REQUEST", { message: `A pasta ${resolved} não existe` });
	}

	if (!info.isDirectory()) {
		throw new ORPCError("BAD_REQUEST", { message: `${resolved} não é uma pasta` });
	}

	return resolved;
}

export const shellsRouter = {
	create: protectedProcedure.input(ShellCreateSchema).handler(async ({ input }) => {
		const cwd = await resolveCwd(input.cwd);
		return shellRuntime.execute({
			type: "open",
			cwd,
			cols: input.cols,
			rows: input.rows,
			label: input.label,
			projectId: input.projectId ?? null,
		});
	}),

	list: protectedProcedure.handler(() => ({ shells: shellRuntime.snapshot() })),

	get: protectedProcedure.input(ShellIdSchema).handler(({ input }) => {
		const shell = shellRuntime.snapshot(input.id);
		if (!shell) {
			throw new ORPCError("NOT_FOUND", { message: "Shell não encontrado" });
		}

		return shell;
	}),

	rename: protectedProcedure.input(ShellRenameSchema).handler(({ input }) => {
		const shell = shellRuntime.execute({ type: "rename", id: input.id, label: input.label });
		if (!shell) {
			throw new ORPCError("NOT_FOUND", { message: "Shell não encontrado" });
		}

		return { ok: true, shell };
	}),

	resize: protectedProcedure.input(ShellResizeSchema).handler(({ input }) => {
		if (!shellRuntime.execute({ type: "resize", ...input })) {
			throw new ORPCError("NOT_FOUND", { message: "Shell não encontrado ou encerrado" });
		}

		return { ok: true };
	}),

	input: protectedProcedure.input(ShellInputSchema).handler(({ input }) => {
		if (!shellRuntime.execute({ type: "input", ...input })) {
			throw new ORPCError("NOT_FOUND", { message: "Shell não encontrado ou encerrado" });
		}

		return { ok: true };
	}),

	close: protectedProcedure.input(ShellIdSchema).handler(({ input }) => {
		if (!shellRuntime.execute({ type: "close", id: input.id })) {
			throw new ORPCError("NOT_FOUND", { message: "Shell não encontrado" });
		}

		return { ok: true };
	}),
};
