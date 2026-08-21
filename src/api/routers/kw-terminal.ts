import { ORPCError } from "@orpc/server";

import { protectedProcedure } from "../auth/context";
import { dbProjects } from "../db/projects";
import {
	ensureKwTerminalServer,
	kwTerminalTabClose,
	kwTerminalTabCreateInWorkspace,
	kwTerminalTabFocus,
	kwTerminalTabList,
	kwTerminalTabRename,
	kwTerminalWorkspaceClose,
	kwTerminalWorkspaceFocus,
	kwTerminalWorkspaceList,
	kwTerminalWorkspaceRename,
} from "../helpers/terminal/kw-terminal";
import { Terminal } from "../helpers/terminal/service";
import {
	KwTerminalSessionStartSchema,
	KwTerminalSessionResumeLastSchema,
	KwTerminalTabCloseSchema,
	KwTerminalTabCreateSchema,
	KwTerminalTabFocusSchema,
	KwTerminalTabRenameSchema,
	KwTerminalWorkspaceCloseSchema,
	KwTerminalWorkspaceFocusSchema,
	KwTerminalWorkspaceRenameSchema,
} from "../schemas/kw-terminal";

export const kwTerminalRouter = {
	overview: protectedProcedure.handler(async () => {
		await ensureKwTerminalServer();
		const workspaces = await kwTerminalWorkspaceList();
		const withTabs = await Promise.all(
			workspaces.map(async (workspace) =>
				Object.assign(workspace, { tabs: await kwTerminalTabList(workspace.workspace_id) }),
			),
		);

		return { workspaces: withTabs };
	}),

	tabCreate: protectedProcedure.input(KwTerminalTabCreateSchema).handler(async ({ input }) => {
		await ensureKwTerminalServer();
		return kwTerminalTabCreateInWorkspace(input.workspaceId);
	}),

	tabRename: protectedProcedure.input(KwTerminalTabRenameSchema).handler(async ({ input }) => {
		await ensureKwTerminalServer();
		return kwTerminalTabRename(input.tabId, input.label);
	}),

	tabFocus: protectedProcedure.input(KwTerminalTabFocusSchema).handler(async ({ input }) => {
		await ensureKwTerminalServer();

		if (!(await kwTerminalTabFocus(input.tabId))) {
			throw new ORPCError("NOT_FOUND", { message: "Falha ao focar a tab no kw-terminal" });
		}

		return { ok: true };
	}),

	tabClose: protectedProcedure.input(KwTerminalTabCloseSchema).handler(async ({ input }) => {
		await ensureKwTerminalServer();

		if (!(await kwTerminalTabClose(input.tabId))) {
			throw new ORPCError("NOT_FOUND", { message: "Falha ao fechar a tab no kw-terminal" });
		}

		return { ok: true };
	}),

	workspaceFocus: protectedProcedure
		.input(KwTerminalWorkspaceFocusSchema)
		.handler(async ({ input }) => {
			await ensureKwTerminalServer();

			if (!(await kwTerminalWorkspaceFocus(input.workspaceId))) {
				throw new ORPCError("NOT_FOUND", { message: "Falha ao focar o workspace no kw-terminal" });
			}

			return { ok: true };
		}),

	workspaceRename: protectedProcedure
		.input(KwTerminalWorkspaceRenameSchema)
		.handler(async ({ input }) => {
			await ensureKwTerminalServer();
			return kwTerminalWorkspaceRename(input.workspaceId, input.label);
		}),

	workspaceClose: protectedProcedure
		.input(KwTerminalWorkspaceCloseSchema)
		.handler(async ({ input }) => {
			await ensureKwTerminalServer();

			if (!(await kwTerminalWorkspaceClose(input.workspaceId))) {
				throw new ORPCError("NOT_FOUND", { message: "Falha ao fechar o workspace no kw-terminal" });
			}

			return { ok: true };
		}),

	// Sessão livre: tab nova no workspace do projeto com o CLI já subindo nela. O pane entra na
	// central sozinho quando o daemon detecta o agent, então aqui basta devolver o pane raiz.
	sessionStart: protectedProcedure
		.input(KwTerminalSessionStartSchema)
		.handler(async ({ input }) => {
			const project = await dbProjects.getById(input.projectId);
			if (!project) {
				throw new ORPCError("NOT_FOUND", { message: "Projeto não encontrado" });
			}

			return Terminal.startSession({
				projectName: project.name,
				mainRoute: project.main_route,
				...input,
			});
		}),

	sessionResumeLast: protectedProcedure
		.input(KwTerminalSessionResumeLastSchema)
		.handler(async ({ input }) => {
			const project = await dbProjects.getById(input.projectId);
			if (!project) {
				throw new ORPCError("NOT_FOUND", { message: "Projeto não encontrado" });
			}

			return Terminal.resumeSession({
				projectName: project.name,
				mainRoute: project.main_route,
				...input,
			});
		}),
};
