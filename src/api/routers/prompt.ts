import { protectedProcedure } from "../auth/context";
import { runPromptAutofill } from "../helpers/prompt-autofill";
import { PromptAutofillSchema } from "../schemas";

export const promptRouter = {
	autofill: protectedProcedure
		.input(PromptAutofillSchema)
		.handler(({ input }) => runPromptAutofill(input)),
};
