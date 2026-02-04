import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { orpc } from "@/client";
import type { SkillRecord, TaskSkill } from "@/types/skills";

const DEFAULT_SKILL_ICON = "FolderOpen";
const DEFAULT_SKILL_COLOR = "#94a3b8";

function toTaskSkill(skill: SkillRecord): TaskSkill {
	const metadata = (skill.metadata ?? {}) as Record<string, unknown>;
	const icon = typeof metadata.icon === "string" ? metadata.icon : DEFAULT_SKILL_ICON;
	const color = typeof metadata.color === "string" ? metadata.color : DEFAULT_SKILL_COLOR;
	const requiresSubtaskSelection =
		metadata.multiSelect === true || metadata.requiresSubtaskSelection === true;
	const title =
		typeof metadata.title === "string" && metadata.title.trim() ? metadata.title : skill.name;

	return {
		id: skill.slug,
		slug: skill.slug,
		label: title,
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
