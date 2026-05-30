import { z } from "zod";

// Wall-clock naive-local fixed-width: 'YYYY-MM-DDTHH:mm', zero-padded. A largura fixa é o que
// torna ordenação lexicográfica == cronológica nas queries de intervalo. O regex rejeita string
// mal-formada que quebraria essa equivalência (ex: hora sem zero à esquerda).
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const dateTimeRegex = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;
const hexColorRegex = /^#[0-9a-fA-F]{6}$/;

const dateField = z.string().regex(dateRegex, "Data deve estar em YYYY-MM-DD");
const dateTimeField = z.string().regex(dateTimeRegex, "Instante deve estar em YYYY-MM-DDTHH:mm");

export const EventIdSchema = z.object({
	id: z.string().trim().min(1),
});

export const EventListByRangeSchema = z
	.object({
		startDate: dateField,
		endDate: dateField,
	})
	.refine((v) => v.endDate >= v.startDate, {
		message: "endDate deve ser >= startDate",
	});

// Edges distrust: além do formato, valida coerência temporal. (1) fim não antes do início;
// (2) all-day obriga horas zeradas — rejeita horário fake num evento de dia inteiro. O end_at
// final (e a guarda de duração-zero) é normalizado no router; aqui só barramos o que é inválido.
const refineEventTime = <T extends { startAt?: string; endAt?: string | null; allDay?: boolean }>(
	schema: z.ZodType<T>,
) =>
	schema
		.refine((v) => !v.endAt || !v.startAt || v.endAt >= v.startAt, {
			message: "endAt deve ser >= startAt",
		})
		.refine((v) => !v.allDay || !v.startAt || v.startAt.endsWith("T00:00"), {
			message: "Evento de dia inteiro deve começar em T00:00",
		})
		.refine((v) => !v.allDay || !v.endAt || v.endAt.endsWith("T00:00"), {
			message: "Evento de dia inteiro deve terminar em T00:00",
		});

export const EventCreateSchema = refineEventTime(
	z.object({
		title: z
			.string()
			.trim()
			.nullable()
			.optional()
			.transform((v) => (v === "" ? null : v)),
		startAt: dateTimeField,
		endAt: dateTimeField.optional(),
		allDay: z.boolean().optional().default(false),
		taskId: z.string().trim().min(1).nullable().optional(),
		color: z.string().regex(hexColorRegex, "Cor deve ser hex #rrggbb").nullable().optional(),
		icon: z.string().trim().min(1).nullable().optional(),
		notes: z
			.string()
			.trim()
			.nullable()
			.optional()
			.transform((v) => (v === "" ? null : v)),
	}),
);

export const EventUpdateSchema = refineEventTime(
	z.object({
		id: z.string().trim().min(1),
		title: z
			.string()
			.trim()
			.nullable()
			.optional()
			.transform((v) => (v === "" ? null : v)),
		startAt: dateTimeField.optional(),
		endAt: dateTimeField.nullable().optional(),
		allDay: z.boolean().optional(),
		taskId: z.string().trim().min(1).nullable().optional(),
		color: z.string().regex(hexColorRegex, "Cor deve ser hex #rrggbb").nullable().optional(),
		icon: z.string().trim().min(1).nullable().optional(),
		notes: z
			.string()
			.trim()
			.nullable()
			.optional()
			.transform((v) => (v === "" ? null : v)),
	}),
);

export type EventCreateInput = z.infer<typeof EventCreateSchema>;
export type EventUpdateInput = z.infer<typeof EventUpdateSchema>;
export type EventListByRangeInput = z.infer<typeof EventListByRangeSchema>;

export const EventDbCreateSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1).nullable().optional(),
	start_at: z.string().min(1),
	end_at: z.string().min(1),
	all_day: z.number().int().optional(),
	task_id: z.string().min(1).nullable().optional(),
	color: z.string().min(1).nullable().optional(),
	icon: z.string().min(1).nullable().optional(),
	notes: z.string().min(1).nullable().optional(),
	created_at: z.number().int().optional(),
	updated_at: z.number().int().optional(),
});

export const EventDbUpdateSchema = EventDbCreateSchema.omit({
	id: true,
	created_at: true,
}).partial();

export type EventDbCreateInput = z.infer<typeof EventDbCreateSchema>;
export type EventDbUpdateInput = z.infer<typeof EventDbUpdateSchema>;
