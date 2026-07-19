import type { TaskSkill } from "@/types/skills";

function matchRank(skill: TaskSkill, term: string) {
	const label = skill.label.toLowerCase();
	const slug = skill.slug.toLowerCase();
	const description = skill.description.toLowerCase();

	if (label === term) return 0;
	if (label.startsWith(term)) return 1;
	if (label.includes(term)) return 2;
	if (slug === term) return 3;
	if (slug.startsWith(term)) return 4;
	if (slug.includes(term)) return 5;
	if (description.includes(term)) return 6;

	return null;
}

export function searchSkills(skills: TaskSkill[], query: string) {
	const term = query.trim().toLowerCase();
	if (!term) return skills;

	return skills
		.map((skill, index) => ({ skill, index, rank: matchRank(skill, term) }))
		.filter(
			(match): match is { skill: TaskSkill; index: number; rank: number } => match.rank !== null,
		)
		.sort((left, right) => left.rank - right.rank || left.index - right.index)
		.map((match) => match.skill);
}
