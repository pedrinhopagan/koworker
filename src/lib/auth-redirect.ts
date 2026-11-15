import { z } from "zod";

export const AuthRedirectSearchSchema = z.object({
	redirect: z
		.union([
			z
				.string()
				.max(2000)
				.regex(/^\/(?!\/)[^\\\p{Cc}]*$/u)
				.refine((path) => !/^\/(login|dispositivo)([/?#]|$)/.test(path)),
			z.unknown().transform(() => "/"),
		])
		.optional(),
});
