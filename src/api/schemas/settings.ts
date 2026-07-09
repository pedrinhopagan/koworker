import { z } from "zod";

export const SettingsUpdateSchema = z.object({
	projectsBasePath: z.string().min(1).optional(),
	terminalTemplate: z.string().min(1).optional(),
	terminalMultiplexer: z.enum(["tmux", "none", "kw-terminal"]).optional(),
});
