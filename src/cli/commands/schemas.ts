import { z } from "zod";

export const taskStatusSchema = z.enum(["pending", "in_execution", "executed"]);

export const criterionSchema = z.object({
	id: z.string(),
	text: z.string(),
	done: z.boolean(),
});

export const createSubtaskInputSchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	status: taskStatusSchema.optional(),
	displayOrder: z.number().int().optional(),
});

export const updateSubtaskInputSchema = createSubtaskInputSchema.extend({
	id: z.string().min(1).optional(),
});

function formatIssuePath(path: readonly PropertyKey[]): string {
	if (!path.length) {
		return "(root)";
	}

	return path
		.map((segment) => (typeof segment === "symbol" ? segment.toString() : String(segment)))
		.join(".");
}

export function parseJsonInput<T extends z.ZodTypeAny>(
	jsonInput: string | undefined,
	schema: T,
): z.output<T> {
	if (!jsonInput) {
		throw new Error("JSON de input é obrigatório");
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonInput);
	} catch {
		throw new Error("JSON inválido");
	}

	const result = schema.safeParse(parsed);
	if (!result.success) {
		const issues = result.error.issues
			.map((issue) => `  - ${formatIssuePath(issue.path)}: ${issue.message}`)
			.join("\n");
		throw new Error(`Validação falhou:\n${issues}`);
	}

	return result.data;
}
