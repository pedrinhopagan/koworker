import { cliCommands } from "@/constants/cli-commands";
import { matchRank } from "@/lib/skill-search";
import type { TaskSkill } from "@/types/skills";

export type SlashItem =
	| {
			kind: "command";
			key: string;
			name: string;
			description: string;
			keywords: string[];
	  }
	| {
			kind: "skill";
			key: string;
			name: string;
			description: string;
			keywords: string[];
			skill: TaskSkill;
	  };

// Comando de CLI só existe como primeira coisa do input, porque é assim que a própria CLI o lê: no
// meio de uma frase `/algo` é texto. Skill vale nas duas posições.
export function buildSlashItems({
	skills,
	cli,
	atStart,
}: {
	skills: TaskSkill[];
	cli?: string;
	atStart: boolean;
}): SlashItem[] {
	const commands: SlashItem[] = atStart
		? cliCommands(cli).map((command) => ({
				kind: "command",
				key: `command:${command.name}`,
				name: command.name,
				description: command.description,
				keywords: command.keywords ?? [],
			}))
		: [];

	return [
		...commands,
		...skills.map(
			(skill): SlashItem => ({
				kind: "skill",
				key: `skill:${skill.slug}`,
				name: skill.slug,
				description: skill.description,
				keywords: [],
				skill,
			}),
		),
	];
}

export function searchSlashItems(items: SlashItem[], query: string) {
	const term = query.trim().toLowerCase();
	if (!term) return items;

	return items
		.map((item, index) => ({
			item,
			index,
			rank: matchRank(
				{
					title: item.kind === "skill" ? item.skill.label : item.name,
					slug: item.name,
					description: item.description,
					keywords: item.keywords,
				},
				term,
			),
		}))
		.filter(
			(match): match is { item: SlashItem; index: number; rank: number } => match.rank !== null,
		)
		.sort((left, right) => left.rank - right.rank || left.index - right.index)
		.map((match) => match.item);
}
