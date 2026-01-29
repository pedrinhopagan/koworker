import { AuthLoginSchema } from "./auth";

export { AuthLoginSchema } from "./auth";
export { CategoryCreateSchema, CategoryIdSchema, CategoryUpdateSchema } from "./categories";
export { PriorityCreateSchema, PriorityIdSchema, PriorityUpdateSchema } from "./priorities";
export { ProjectCreateSchema, ProjectIdSchema, ProjectUpdateSchema } from "./projects";
export {
	SubtaskCreateSchema,
	SubtaskIdSchema,
	SubtaskListByTaskSchema,
	SubtaskUpdateSchema,
} from "./subtasks";
export {
	AcceptanceCriteriaItemSchema,
	TaskCreateSchema,
	TaskIdSchema,
	TaskListByProjectSchema,
	TaskStatusSchema,
	TaskUpdateSchema,
} from "./tasks";

export const EndpointSchemas = {
	authLogin: AuthLoginSchema,
};
