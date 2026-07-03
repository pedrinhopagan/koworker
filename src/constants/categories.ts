import type { PromptTemplateSlug } from "./prompt-templates";

// Categorias semeadas no primeiro boot (e pelo script de seed). Cada uma já nasce vinculada à
// estrutura de prompt de mesmo nome — o vínculo categoria→estrutura sai de fábrica coerente.
export const DEFAULT_CATEGORIES: {
	name: string;
	color: string;
	structureSlug: PromptTemplateSlug;
}[] = [
	{ name: "feature", color: "#22c55e", structureSlug: "feature" },
	{ name: "fix", color: "#ef4444", structureSlug: "fix" },
	{ name: "doc", color: "#a855f7", structureSlug: "doc" },
	{ name: "study", color: "#3b82f6", structureSlug: "study" },
];
