import { protectedProcedure } from "../auth/context";
import { TaskFlow } from "../helpers/flow";
import { FlowTaskSchema } from "../schemas";

export const flowRouter = {
	run: protectedProcedure
		.input(FlowTaskSchema)
		.handler(({ input, context }) => TaskFlow.run(input.taskId, context.user.id)),

	status: protectedProcedure
		.input(FlowTaskSchema)
		.handler(({ input, context }) => TaskFlow.status(input.taskId, context.user.id)),
};
