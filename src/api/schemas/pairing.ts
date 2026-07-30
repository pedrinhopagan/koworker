import { z } from "zod";

export const PairingConsumeSchema = z.object({
	token: z.string().trim().min(16).max(64),
});
