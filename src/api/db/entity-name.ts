export function normalizeEntityName(value: string) {
	return value
		.normalize("NFD")
		.replaceAll(/[\u0300-\u036F]/g, "")
		.trim()
		.toLowerCase();
}
