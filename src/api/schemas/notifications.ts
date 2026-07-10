import { z } from "zod";

export const PushSubscriptionSchema = z.object({
	endpoint: z.url(),
	expirationTime: z.number().int().nullable().optional(),
	keys: z.object({
		p256dh: z.string().min(1),
		auth: z.string().min(1),
	}),
});

export const PushUnsubscribeSchema = z.object({
	endpoint: z.url(),
});

export type PushSubscriptionInput = z.infer<typeof PushSubscriptionSchema>;
