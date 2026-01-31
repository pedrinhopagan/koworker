import { AuthLoginSchema } from "./auth";

export { AuthLoginSchema } from "./auth";
export {
	CategoryCreateSchema,
	CategoryIdSchema,
	CategoryMigrateAndDeleteSchema,
	CategoryReorderSchema,
	CategoryUpdateSchema,
} from "./categories";
export {
	PriorityCreateSchema,
	PriorityIdSchema,
	PriorityMigrateAndDeleteSchema,
	PriorityReorderSchema,
	PriorityUpdateSchema,
} from "./priorities";
export {
	ProjectCreateSchema,
	ProjectIdSchema,
	ProjectReorderSchema,
	ProjectUpdateSchema,
} from "./projects";
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
	TaskGetAllSchema,
	TaskIdSchema,
	TaskListByDateSchema,
	TaskListByProjectSchema,
	TaskListByWeekSchema,
	TaskMetricsSchema,
	TaskStatusSchema,
	TaskUpdateSchema,
} from "./tasks";

export {
	ExecutionCreateMessageSchema,
	ExecutionGetByTaskIdSchema,
	ExecutionMessageRoleSchema,
} from "./execution";

export const EndpointSchemas = {
	authLogin: AuthLoginSchema,
};
