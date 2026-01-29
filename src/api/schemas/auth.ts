import { z } from "zod";

export const AuthLoginSchema = z.object({
	name: z.string().min(1),
	password: z.string().min(1),
});

export type AuthLoginInput = z.infer<typeof AuthLoginSchema>;
