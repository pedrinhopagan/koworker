import { protectedProcedure } from "../auth/context";
import { dbPromptHistory } from "../db/prompt-history";
import { PromptHistoryRecordSchema } from "../schemas/prompt-history";

export const promptHistoryRouter = {
	record: protectedProcedure.input(PromptHistoryRecordSchema).handler(async ({ input }) => {
		await dbPromptHistory.record(input);
		return { success: true };
	}),
};
