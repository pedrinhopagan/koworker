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
	ProjectDocWriteSchema,
	ProjectIdSchema,
	ProjectReorderSchema,
	ProjectUpdateSchema,
} from "./projects";
export {
	SkillCategoryCreateSchema,
	SkillCategoryIdSchema,
	SkillCategoryUpdateSchema,
} from "./skill-categories";
export {
	SkillCreateSchema,
	SkillDeleteSchema,
	SkillListSchema,
	SkillSettingsSchema,
	SkillUpdateSchema,
} from "./skills";
export {
	AgentCreateSchema,
	AgentDeleteSchema,
	AgentSettingsSchema,
	AgentUpdateSchema,
} from "./agents";
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
	TaskMoveToProjectSchema,
	TaskPromoteSchema,
	TaskRenameFileSchema,
	TaskReorderFilesSchema,
	TaskReorderSchema,
	TaskSetDoneSchema,
	TaskSetFileDateSchema,
	TaskUpdateSchema,
	TaskWriteFileSchema,
	VaultAdoptFolderSchema,
	VaultDeleteFileSchema,
	VaultExportContentSchema,
	VaultGetFileSchema,
	VaultLinkFilesToTaskSchema,
	VaultListSchema,
	VaultMoveFilesToTaskSchema,
	VaultMoveFolderFilesToTaskSchema,
	VaultRenameFileSchema,
	VaultUnlinkFilesSchema,
	VaultWriteFileSchema,
} from "./tasks";

export const EndpointSchemas = {
	authLogin: AuthLoginSchema,
};
