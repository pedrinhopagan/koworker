import { ORPCError } from "@orpc/server";
import { stat } from "node:fs/promises";

import { protectedProcedure } from "../auth/context";
import { shellSupervisor } from "../helpers/shells/supervisor";
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
		return shellSupervisor.open({
			cwd,
			cols: input.cols,
			rows: input.rows,
			label: input.label,
			projectId: input.projectId ?? null,
		});
	}),

	list: protectedProcedure.handler(() => ({ shells: shellSupervisor.list() })),

	get: protectedProcedure.input(ShellIdSchema).handler(({ input }) => {
		const shell = shellSupervisor.get(input.id);
		if (!shell) {
			throw new ORPCError("NOT_FOUND", { message: "Shell não encontrado" });
		}

		return shell;
	}),

	rename: protectedProcedure.input(ShellRenameSchema).handler(({ input }) => {
		const shell = shellSupervisor.rename(input.id, input.label);
		if (!shell) {
			throw new ORPCError("NOT_FOUND", { message: "Shell não encontrado" });
		}

		return { ok: true, shell };
	}),

	resize: protectedProcedure.input(ShellResizeSchema).handler(({ input }) => {
		if (!shellSupervisor.resize(input.id, input.cols, input.rows)) {
			throw new ORPCError("NOT_FOUND", { message: "Shell não encontrado ou encerrado" });
		}

		return { ok: true };
	}),

	input: protectedProcedure.input(ShellInputSchema).handler(({ input }) => {
		if (!shellSupervisor.write(input.id, input.data)) {
			throw new ORPCError("NOT_FOUND", { message: "Shell não encontrado ou encerrado" });
		}

		return { ok: true };
	}),

	close: protectedProcedure.input(ShellIdSchema).handler(({ input }) => {
		if (!shellSupervisor.close(input.id)) {
			throw new ORPCError("NOT_FOUND", { message: "Shell não encontrado" });
		}

		return { ok: true };
	}),
};
