import { z } from "zod";

export const DeviceIdSchema = z.object({
	deviceId: z.string().min(1),
});

export const DeviceRenameSchema = z.object({
	deviceId: z.string().min(1),
	name: z.string().trim().min(1).max(60),
});
