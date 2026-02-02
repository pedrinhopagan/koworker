import { z } from "zod";

import { publicProcedure } from "../auth/context";
import { PubSub, type TerminalEvent, type TerminalEventType } from "../pubsub";

const TerminalNotifySchema = z.object({
	event_type: z.enum(["session_opened", "session_closed", "window_opened", "window_closed"]),
	project_id: z.string(),
	task_id: z.string().optional().nullable(),
	session_name: z.string(),
	window_name: z.string().optional().nullable(),
});

export const terminalRouter = {
	notify: publicProcedure.input(TerminalNotifySchema).handler(async ({ input }) => {
		const event: TerminalEvent = {
			eventType: input.event_type as TerminalEventType,
			projectId: input.project_id,
			taskId: input.task_id ?? undefined,
			sessionName: input.session_name,
			windowName: input.window_name ?? undefined,
		};

		await PubSub.terminal.publish(event);

		return { ok: true };
	}),
};

export const terminalWsRouter = {
	events: publicProcedure.handler(({ signal }) => PubSub.terminal.subscribe(signal)),
};
