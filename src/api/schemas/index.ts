import { AuthLoginSchema } from "./auth";

export { AuthLoginSchema } from "./auth";
export {
	CategoryCreateSchema,
	CategoryIdSchema,
	CategoryMigrateAndDeleteSchema,
	CategoryUpdateSchema,
} from "./categories";
export {
	PriorityCreateSchema,
	PriorityIdSchema,
	PriorityMigrateAndDeleteSchema,
	PriorityReorderSchema,
	PriorityUpdateSchema,
} from "./priorities";
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
	TaskFocusSchema,
	TaskIdSchema,
	TaskListByDateSchema,
	TaskListByProjectSchema,
	TaskListByWeekSchema,
	TaskMetricsSchema,
	TaskStatusSchema,
	TaskUpdateSchema,
} from "./tasks";

export const EndpointSchemas = {
	authLogin: AuthLoginSchema,
};
