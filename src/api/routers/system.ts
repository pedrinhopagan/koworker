import { protectedProcedure } from "../auth/context";
import { browseDirectory, openInFileManager, shareZip } from "../helpers/os-actions";
import { BrowseDirectorySchema, OsPathSchema } from "../schemas/system";

export const systemRouter = {
	browseDirectory: protectedProcedure
		.input(BrowseDirectorySchema)
		.handler(({ input }) => browseDirectory(input.path ?? "")),

	openFolder: protectedProcedure.input(OsPathSchema).handler(({ input }) => {
		openInFileManager(input.path);
		return { ok: true };
	}),

	shareZip: protectedProcedure.input(OsPathSchema).handler(({ input }) => shareZip(input.path)),
};
