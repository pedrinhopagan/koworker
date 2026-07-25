import { z } from "zod";

import { TERMINAL_MULTIPLEXERS } from "@/constants/terminal";

export const SettingsUpdateSchema = z.object({
	projectsBasePath: z.string().min(1).optional(),
	terminalTemplate: z
		.string()
		.min(1)
		.refine((value) => value.includes("{command}"), {
			message: "O template de terminal precisa conter {command}",
		})
		.optional(),
	terminalMultiplexer: z.enum(TERMINAL_MULTIPLEXERS).optional(),
});
