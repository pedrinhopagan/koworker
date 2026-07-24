import { z } from "zod";

const TaskStorageFingerprintSchema = z.object({
	entries: z.array(
		z.object({
			path: z.string(),
			size: z.number().nonnegative(),
			hash: z.string(),
		}),
	),
	hash: z.string(),
	size: z.number().nonnegative(),
});

const TaskStorageScanItemSchema = z.object({
	taskId: z.string(),
	title: z.string(),
	kind: z.enum([
		"correct",
		"flat_migratable",
		"nested_compatible",
		"missing_folder",
		"source_destination_identical",
		"source_destination_divergent",
		"feature_missing",
		"feature_cross_project",
		"unsafe_path",
		"soft_deleted_reappeared",
		"identity_missing",
		"version_unknown",
	]),
	blocked: z.boolean(),
	sourcePath: z.string(),
	destinationPath: z.string().optional(),
	storageKey: z.string().optional(),
	storageSlug: z.string().optional(),
	groupId: z.string().optional(),
	source: TaskStorageFingerprintSchema.optional(),
	destination: TaskStorageFingerprintSchema.optional(),
});

export const TaskStoragePlanSchema = z.object({
	projectId: z.string(),
	fromLayoutVersion: z.number().int(),
	toLayoutVersion: z.number().int(),
	items: z.array(TaskStorageScanItemSchema),
	orphans: z.array(
		z.object({
			folderPath: z.string(),
			fingerprint: TaskStorageFingerprintSchema.optional(),
			unsafe: z.boolean(),
		}),
	),
	planHash: z.string(),
	totals: z.object({
		blocked: z.number().int().nonnegative(),
		correct: z.number().int().nonnegative(),
		orphaned: z.number().int().nonnegative(),
		toApply: z.number().int().nonnegative(),
	}),
});

export const TaskStoragePreviewSchema = z.object({
	projectId: z.string().min(1),
});

export const TaskStorageApplySchema = z.object({
	projectId: z.string().min(1),
	planHash: z.string().min(1),
	confirmed: z.literal(true),
});

export const TaskStorageRunSchema = z.object({
	runId: z.string().min(1),
});

export const TaskStorageCleanBackupsSchema = z.object({
	projectId: z.string().min(1),
	runIds: z.array(z.string().min(1)).min(1),
});
