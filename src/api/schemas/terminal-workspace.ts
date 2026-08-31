import { z } from "zod";

import { AGENT_RADAR_STATUSES } from "@/constants/agent-radar";

export const TERMINAL_GRID_LIMITS = {
	minCols: 2,
	maxCols: 500,
	minRows: 2,
	maxRows: 500,
} as const;

export const TERMINAL_LABEL_MAX_LENGTH = 60;
export const TERMINAL_INPUT_MAX_LENGTH = 8192;

export const ShellAgentStatusSchema = z.enum(["working", "idle"]);
export type ShellAgentStatus = z.infer<typeof ShellAgentStatusSchema>;

export const ShellRecordSchema = z.object({
	id: z.string(),
	label: z.string(),
	cwd: z.string(),
	projectId: z.string().nullable(),
	cols: z.number().int(),
	rows: z.number().int(),
	createdAt: z.number().int(),
	title: z.string().nullable(),
	status: z.enum(["live", "exited"]),
	exitCode: z.number().int().nullable(),
	pid: z.number().int(),
	agent: z.string().nullable(),
	agentStatus: ShellAgentStatusSchema.nullable(),
});
export type ShellRecord = z.infer<typeof ShellRecordSchema>;

export const RadarFocusSchema = z.object({
	workspaceId: z.string().nullable(),
	tabId: z.string().nullable(),
	paneId: z.string().nullable(),
});
export type RadarFocus = z.infer<typeof RadarFocusSchema>;

export const RadarAgentSchema = z.object({
	paneId: z.string(),
	workspaceId: z.string(),
	workspaceLabel: z.string(),
	tabId: z.string(),
	tabLabel: z.string(),
	agent: z.string(),
	status: z.enum(AGENT_RADAR_STATUSES),
	activity: z.string().nullable(),
	title: z.string().nullable(),
	cwd: z.string(),
	projectId: z.string().nullable(),
	projectName: z.string().nullable(),
	sessionId: z.string().nullable(),
	sessionPath: z.string().nullable(),
	taskId: z.string().nullable(),
	taskTitle: z.string().nullable(),
	changedAt: z.number().int(),
});
export type RadarAgent = z.infer<typeof RadarAgentSchema>;

export const TerminalWorkspaceCapabilitiesSchema = z.object({
	rename: z.boolean(),
	close: z.boolean(),
	converse: z.boolean(),
	interrupt: z.boolean(),
	focusExternal: z.boolean(),
	diff: z.boolean(),
	replay: z.boolean(),
	scroll: z.boolean(),
	resize: z.boolean(),
});
export type TerminalWorkspaceCapabilities = z.infer<typeof TerminalWorkspaceCapabilitiesSchema>;

const TerminalWorkspaceEntryBaseSchema = z.object({
	key: z.string(),
	id: z.string(),
	label: z.string(),
	groupLabel: z.string(),
	cwd: z.string(),
	projectId: z.string().nullable(),
	projectName: z.string().nullable(),
	agent: z.string().nullable(),
	taskId: z.string().nullable(),
	taskTitle: z.string().nullable(),
	capabilities: TerminalWorkspaceCapabilitiesSchema,
});

export const TerminalWorkspaceEntrySchema = z.discriminatedUnion("kind", [
	TerminalWorkspaceEntryBaseSchema.extend({
		kind: z.literal("shell"),
		status: z.enum(["live", "exited", "working", "idle"]),
		statusFidelity: z.literal("activity"),
		title: z.string().nullable(),
		activity: z.null(),
		createdAt: z.number().int(),
		changedAt: z.number().int(),
		exitCode: z.number().int().nullable(),
	}),
	TerminalWorkspaceEntryBaseSchema.extend({
		kind: z.literal("agent"),
		status: z.enum(AGENT_RADAR_STATUSES),
		statusFidelity: z.literal("semantic"),
		title: z.string().nullable(),
		activity: z.string().nullable(),
		createdAt: z.null(),
		changedAt: z.number().int(),
		exitCode: z.null(),
	}),
]);
export type TerminalWorkspaceEntry = z.infer<typeof TerminalWorkspaceEntrySchema>;

export const TerminalWorkspaceSnapshotSchema = z.object({
	revision: z.number().int().nonnegative(),
	entries: z.array(TerminalWorkspaceEntrySchema),
	focus: RadarFocusSchema,
});
export type TerminalWorkspaceSnapshot = z.infer<typeof TerminalWorkspaceSnapshotSchema>;
