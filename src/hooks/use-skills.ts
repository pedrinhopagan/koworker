import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/client";
import type { SkillRecord, TaskSkill } from "@/types/skills";

const DEFAULT_SKILL_ICON = "FolderOpen";
const DEFAULT_SKILL_COLOR = "#94a3b8";

function toTaskSkill(skill: SkillRecord): TaskSkill {
	const metadata = (skill.metadata ?? {}) as Record<string, unknown>;
	const icon = typeof metadata.icon === "string" ? metadata.icon : DEFAULT_SKILL_ICON;
	const color = typeof metadata.color === "string" ? metadata.color : DEFAULT_SKILL_COLOR;
	const requiresSubtaskSelection = metadata.requiresSubtaskSelection === true;

	return {
		id: skill.slug,
		slug: skill.slug,
		label: skill.name,
		description: skill.description,
		instructions: skill.content ?? "",
		icon,
		color,
		source: skill.source,
		requiresSubtaskSelection,
	};
}

export function useSkillsQuery() {
	const query = useQuery(orpc.skills.list.queryOptions());
	const taskSkills = useMemo(() => (query.data ?? []).map(toTaskSkill), [query.data]);

	return {
		...query,
		taskSkills,
	};
}
