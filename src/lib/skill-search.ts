import type { TaskSkill } from "@/types/skills";

type MatchFields = {
	title: string;
	slug: string;
	description: string;
	keywords?: string[];
};

// Escala única do menu de barra: título e apelido primeiro, slug depois, descrição por último. O
// apelido entra logo abaixo do título exato porque é o que faz `/new` achar o `/clear` do claude.
export function matchRank(fields: MatchFields, term: string) {
	const title = fields.title.toLowerCase();
	const slug = fields.slug.toLowerCase();
	const description = fields.description.toLowerCase();
	const keywords = (fields.keywords ?? []).map((keyword) => keyword.toLowerCase());

	if (title === term) return 0;
	if (keywords.some((keyword) => keyword === term)) return 1;
	if (title.startsWith(term)) return 2;
	if (keywords.some((keyword) => keyword.startsWith(term))) return 3;
	if (title.includes(term)) return 4;
	if (slug === term) return 5;
	if (slug.startsWith(term)) return 6;
	if (slug.includes(term)) return 7;
	if (description.includes(term)) return 8;

	return null;
}

export function searchSkills(skills: TaskSkill[], query: string) {
	const term = query.trim().toLowerCase();
	if (!term) return skills;

	return skills
		.map((skill, index) => ({
			skill,
			index,
			rank: matchRank(
				{
					title: skill.label,
					slug: skill.slug,
					description: skill.description,
				},
				term,
			),
		}))
		.filter(
			(match): match is { skill: TaskSkill; index: number; rank: number } => match.rank !== null,
		)
		.sort((left, right) => left.rank - right.rank || left.index - right.index)
		.map((match) => match.skill);
}
