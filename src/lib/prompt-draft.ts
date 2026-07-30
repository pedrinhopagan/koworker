import { z } from "zod";

import type { PromptImage } from "@/stores/prompt-bar";

export interface PromptDraft {
	text: string;
	images: PromptImage[];
}

const draftSchema = z.object({
	text: z.string(),
	images: z.array(z.object({ index: z.number().int(), projectId: z.string(), name: z.string() })),
});

export function readPromptDraft(key: string): PromptDraft {
	const raw = localStorage.getItem(key);
	if (!raw) {
		return { text: "", images: [] };
	}

	try {
		const parsed = draftSchema.safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : { text: raw, images: [] };
	} catch {
		return { text: raw, images: [] };
	}
}

export function writePromptDraft(key: string, draft: PromptDraft) {
	localStorage.setItem(key, JSON.stringify(draft));
}

export function clearPromptDraft(key: string) {
	localStorage.removeItem(key);
}
