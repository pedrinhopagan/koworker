import { AuthLoginSchema } from "./auth";

export { AuthLoginSchema } from "./auth";
export {
	ProjectCreateSchema,
	ProjectIdSchema,
	ProjectUpdateSchema,
} from "./projects";
export {
	AcceptanceCriteriaItemSchema,
	TaskCreateSchema,
	TaskIdSchema,
	TaskStatusSchema,
	TaskUpdateSchema,
} from "./tasks";
export { SubtaskCreateSchema, SubtaskIdSchema, SubtaskUpdateSchema } from "./subtasks";
export { CategoryCreateSchema, CategoryIdSchema, CategoryUpdateSchema } from "./categories";
export { PriorityCreateSchema, PriorityIdSchema, PriorityUpdateSchema } from "./priorities";

export const EndpointSchemas = {
	authLogin: AuthLoginSchema,
};
