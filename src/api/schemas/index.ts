import { AuthLoginSchema } from "./auth";

export { AuthLoginSchema } from "./auth";
export { AgentRadarPaneSchema, AgentRadarSendSchema } from "./agent-radar";
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
export { AgentSessionIdSchema, AgentSessionListSchema } from "./agent-session";
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
	TaskGroupFolderSchema,
	TaskGroupIdSchema,
	TaskGroupListSchema,
	TaskGroupReorderSchema,
	TaskGroupUpdateSchema,
} from "./task-groups";
export {
	TaskStorageApplySchema,
	TaskStorageCleanBackupsSchema,
	TaskStoragePlanSchema,
	TaskStoragePreviewSchema,
	TaskStorageRunSchema,
} from "./task-storage";
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
	TaskMoveToFeatureSchema,
	TaskMoveToProjectSchema,
	TaskNotifySchema,
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
