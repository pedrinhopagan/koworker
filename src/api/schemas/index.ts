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
	ProjectRouteCreateSchema,
	ProjectRouteIdSchema,
	ProjectRouteReorderSchema,
	ProjectRouteUpdateSchema,
} from "./project-routes";
export {
	ProjectCreateSchema,
	ProjectIdSchema,
	ProjectReorderSchema,
	ProjectUpdateSchema,
} from "./projects";
export { SkillCreateSchema, SkillIdSchema, SkillReorderSchema, SkillUpdateSchema } from "./skills";
export {
	SubtaskCreateSchema,
	SubtaskIdSchema,
	SubtaskListByTaskSchema,
	SubtaskReorderSchema,
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

export const EndpointSchemas = {
	authLogin: AuthLoginSchema,
};
