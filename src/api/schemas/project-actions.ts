import { z } from "zod";

import { PROJECT_ACTION_MODES } from "@/constants/project-actions";

export const ProjectActionsListSchema = z.object({
	projectId: z.string().min(1),
});

export const ProjectActionRunSchema = z.object({
	projectId: z.string().min(1),
	actionId: z.string().min(1),
	mode: z.enum(PROJECT_ACTION_MODES),
});
