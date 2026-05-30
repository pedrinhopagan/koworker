import { AuthLoginSchema } from "./auth";

export { AuthLoginSchema } from "./auth";
export {
	EventCreateSchema,
	EventIdSchema,
	EventListByRangeSchema,
	EventUpdateSchema,
} from "./events";
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
export {
	SkillCreateSchema,
	SkillDeleteSchema,
	SkillListSchema,
	SkillSettingsSchema,
	SkillUpdateSchema,
} from "./skills";
export {
	TaskGroupCreateSchema,
	TaskGroupIdSchema,
	TaskGroupListSchema,
	TaskGroupReorderSchema,
	TaskGroupUpdateSchema,
} from "./task-groups";
export {
	TaskCreateSchema,
	TaskDeleteFileSchema,
	TaskFocusSchema,
	TaskGetAllSchema,
	TaskIdSchema,
	TaskListByProjectSchema,
	TaskMetricsSchema,
	TaskPromoteSchema,
	TaskRenameFileSchema,
	TaskReorderFilesSchema,
	TaskReorderSchema,
	TaskSetDoneSchema,
	TaskSetFileDateSchema,
	TaskUpdateSchema,
	TaskWriteFileSchema,
	VaultDeleteFileSchema,
	VaultLinkFilesToTaskSchema,
	VaultListSchema,
	VaultMoveFilesToTaskSchema,
	VaultRenameFileSchema,
	VaultUnlinkFilesSchema,
	VaultWriteFileSchema,
} from "./tasks";

export const EndpointSchemas = {
	authLogin: AuthLoginSchema,
};
