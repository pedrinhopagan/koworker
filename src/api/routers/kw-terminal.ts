import { protectedProcedure } from "../auth/context";
import {
	ensureKwTerminalServer,
	kwTerminalTabClose,
	kwTerminalTabCreateInWorkspace,
	kwTerminalTabFocus,
	kwTerminalTabList,
	kwTerminalTabRename,
	kwTerminalWorkspaceFocus,
	kwTerminalWorkspaceList,
	kwTerminalWorkspaceRename,
} from "../helpers/terminal/kw-terminal";
import {
	KwTerminalTabCloseSchema,
	KwTerminalTabCreateSchema,
	KwTerminalTabFocusSchema,
	KwTerminalTabRenameSchema,
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
};
