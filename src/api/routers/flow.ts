import { protectedProcedure } from "../auth/context";
import { TaskFlow } from "../helpers/flow";
import { FlowTaskSchema } from "../schemas";

export const flowRouter = {
	run: protectedProcedure.input(FlowTaskSchema).handler(({ input }) => TaskFlow.run(input.taskId)),

	status: protectedProcedure
		.input(FlowTaskSchema)
		.handler(({ input }) => TaskFlow.status(input.taskId)),
};
