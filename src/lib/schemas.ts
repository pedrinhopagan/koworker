import { z } from "zod";

export const loginSchema = z.object({
	name: z.string({ error: "Name is required" }).min(1, "Name is required"),
	password: z.string({ error: "Password is required" }).min(1, "Password is required"),
});
