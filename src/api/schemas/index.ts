import { AuthLoginSchema } from "./auth";

export {
	AgentCategoryCreateSchema,
	AgentCategoryIdSchema,
	AgentCategoryUpdateSchema,
} from "./agent-categories";
export {
	AgentRadarPaneSchema,
	AgentRadarSendSchema,
	AgentRadarTerminalInputSchema,
} from "./agent-radar";
export { AgentSessionIdSchema, AgentSessionListSchema } from "./agent-session";
export {
	AgentCreateSchema,
	AgentDeleteSchema,
	AgentSettingsSchema,
	AgentUpdateSchema,
} from "./agents";
export {
	MediaDeleteSchema,
	MediaListSchema,
	MediaReadFileSchema,
	MediaRenameSchema,
	MediaUploadSchema,
	MostruarioListSchema,
	TaskOpenArtifactSchema,
} from "./assets";
export { AuthLoginSchema } from "./auth";
export { PushSubscriptionSchema, PushUnsubscribeSchema } from "./notifications";
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
	AudioTranscriptionSchema,
	PromptExecuteSchema,
	PromptRunClearSchema,
	PromptRunIdSchema,
	PromptRunListSchema,
	PromptRunRetrySchema,
} from "./prompt";
export {
	ShellCreateSchema,
	ShellIdSchema,
	ShellInputSchema,
	ShellRenameSchema,
	ShellResizeSchema,
} from "./shells";
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
export {
	RadarAgentSchema,
	RadarFocusSchema,
	ShellRecordSchema,
	TerminalWorkspaceEntrySchema,
	TerminalWorkspaceSnapshotSchema,
} from "./terminal-workspace";

export const EndpointSchemas = {
	authLogin: AuthLoginSchema,
};
