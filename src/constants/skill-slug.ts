export const SKILL_SLUG_PATTERN = /^[a-z0-9-]+$/;

export function slugifySkill(value: string) {
	return value
		.normalize("NFD")
		.replaceAll(/[̀-ͯ]/g, "")
		.toLowerCase()
		.trim()
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-+|-+$/g, "");
}
