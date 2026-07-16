import { AuthLoginSchema } from "./auth";

export { AuthLoginSchema } from "./auth";
export {
	MediaDeleteSchema,
	MediaListSchema,
	MediaReadFileSchema,
	MediaRenameSchema,
	MediaUploadSchema,
	MostruarioListSchema,
	TaskOpenArtifactSchema,
} from "./assets";
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
export { FlowTaskSchema } from "./flow";
export {
	AudioTranscriptionSchema,
	PromptAutofillResultSchema,
	PromptAutofillSchema,
	PromptExecuteSchema,
	PromptRunClearSchema,
	PromptRunIdSchema,
	PromptRunListSchema,
	PromptRunRetrySchema,
} from "./prompt";
export { PushSubscriptionSchema, PushUnsubscribeSchema } from "./notifications";
export {
	PromptHistoryCreateSchema,
	PromptHistoryListSchema,
	PromptHistoryRecordSchema,
	PromptHistoryUpdateSchema,
} from "./prompt-history";
export {
	ProjectRouteCreateSchema,
	ProjectRouteIdSchema,
	ProjectRouteReorderSchema,
	ProjectRouteUpdateSchema,
} from "./project-routes";
export {
	ProjectCreateSchema,
	ProjectDocReadSchema,
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
	TaskIgnoreRecencySchema,
	TaskListByProjectSchema,
	TaskMergeReadySchema,
	TaskMetricsSchema,
	TaskMoveToProjectSchema,
	TaskPromoteSchema,
	TaskRenameFileSchema,
	TaskReorderFilesSchema,
	TaskReorderSchema,
	TaskSetDoneSchema,
	TaskSetFileDateSchema,
	TaskSyncCreateSchema,
	TaskSyncDiscoverSchema,
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
