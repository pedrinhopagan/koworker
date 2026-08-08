import { ORPCError } from "@orpc/server";

import { protectedProcedure } from "../auth/context";
import { dbProjects } from "../db/projects";
import { cliResumeArgv, cliStartArgv } from "../helpers/terminal/cli-argv";
import { terminalCommandText } from "../helpers/terminal/command";
import {
	ensureKwTerminalServer,
	findWorkspaceByLabel,
	kwTerminalIntegrationInstall,
	kwTerminalPaneRun,
	kwTerminalTabClose,
	kwTerminalTabCreate,
	kwTerminalTabCreateInWorkspace,
	kwTerminalTabFocus,
	kwTerminalTabList,
	kwTerminalTabRename,
	kwTerminalWorkspaceClose,
	kwTerminalWorkspaceCreate,
	kwTerminalWorkspaceFocus,
	kwTerminalWorkspaceList,
	kwTerminalWorkspaceRename,
} from "../helpers/terminal/kw-terminal";
import { sessionNameForProject, sessionTabName } from "../helpers/terminal/names";
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
			throw new Error("Falha ao focar tab kw-terminal");
		}

		return { ok: true };
	}),

	tabClose: protectedProcedure.input(KwTerminalTabCloseSchema).handler(async ({ input }) => {
		await ensureKwTerminalServer();

		if (!(await kwTerminalTabClose(input.tabId))) {
			throw new Error("Falha ao fechar tab kw-terminal");
		}

		return { ok: true };
	}),

	workspaceFocus: protectedProcedure
		.input(KwTerminalWorkspaceFocusSchema)
		.handler(async ({ input }) => {
			await ensureKwTerminalServer();

			if (!(await kwTerminalWorkspaceFocus(input.workspaceId))) {
				throw new Error("Falha ao focar workspace kw-terminal");
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
				throw new Error("Falha ao fechar workspace kw-terminal");
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

			await ensureKwTerminalServer();
			await kwTerminalIntegrationInstall(input.cli);

			const workspaceLabel = sessionNameForProject(project.name);
			const workspace =
				(await findWorkspaceByLabel(workspaceLabel)) ??
				(await kwTerminalWorkspaceCreate({
					cwd: project.main_route,
					label: workspaceLabel,
					focus: false,
				}));

			const { tab, rootPane } = await kwTerminalTabCreate({
				workspaceId: workspace.workspace_id,
				cwd: project.main_route,
				label: sessionTabName(input.label),
				focus: false,
			});

			await kwTerminalPaneRun(
				rootPane.pane_id,
				terminalCommandText({ kind: "argv", argv: cliStartArgv(input) }),
			);

			return {
				paneId: rootPane.pane_id,
				tabId: tab.tab_id,
				workspaceId: workspace.workspace_id,
			};
		}),

	sessionResumeLast: protectedProcedure
		.input(KwTerminalSessionResumeLastSchema)
		.handler(async ({ input }) => {
			const project = await dbProjects.getById(input.projectId);
			if (!project) {
				throw new ORPCError("NOT_FOUND", { message: "Projeto não encontrado" });
			}

			await ensureKwTerminalServer();
			await kwTerminalIntegrationInstall(input.cli);
			const workspaceLabel = sessionNameForProject(project.name);
			const workspace =
				(await findWorkspaceByLabel(workspaceLabel)) ??
				(await kwTerminalWorkspaceCreate({
					cwd: project.main_route,
					label: workspaceLabel,
					focus: false,
				}));
			const { tab, rootPane } = await kwTerminalTabCreate({
				workspaceId: workspace.workspace_id,
				cwd: project.main_route,
				label: sessionTabName(`Retomar ${input.cli}`),
				focus: false,
			});

			await kwTerminalPaneRun(
				rootPane.pane_id,
				terminalCommandText({ kind: "argv", argv: cliResumeArgv(input.cli) }),
			);

			return {
				paneId: rootPane.pane_id,
				tabId: tab.tab_id,
				workspaceId: workspace.workspace_id,
			};
		}),
};
