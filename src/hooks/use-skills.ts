import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { orpc } from "@/client";
import type { SkillRecord, TaskSkill } from "@/types/skills";

const DEFAULT_SKILL_ICON = "FolderOpen";
const DEFAULT_SKILL_COLOR = "#94a3b8";

function toTaskSkill(skill: SkillRecord): TaskSkill {
	const metadata = (skill.metadata ?? {}) as Record<string, unknown>;
	const metadataIcon = typeof metadata.icon === "string" ? metadata.icon : undefined;
	const metadataColor = typeof metadata.color === "string" ? metadata.color : undefined;
	const requiresSubtaskSelection =
		metadata.multiSelect === true || metadata.requiresSubtaskSelection === true;
	const isBuiltin = skill.sources.some((source) => source.tool === "koworker");

	return {
		id: skill.slug,
		slug: skill.slug,
		label: skill.settings.label ?? skill.name,
		description: skill.description,
		instructions: skill.content,
		icon: skill.settings.icon ?? metadataIcon ?? DEFAULT_SKILL_ICON,
		color: skill.settings.color ?? metadataColor ?? DEFAULT_SKILL_COLOR,
		categoryId: skill.settings.categoryId ?? null,
		source: isBuiltin ? "builtin" : "custom",
		sources: skill.sources,
		conflict: skill.conflict,
		primaryPath: skill.primaryPath,
		primaryDir: skill.primaryDir,
		metadata,
		requiresSubtaskSelection,
	};
}

export function useSkillsQuery(projectName?: string) {
	const query = useQuery(orpc.skills.list.queryOptions({ input: { projectName } }));
	const taskSkills = useMemo(() => (query.data ?? []).map(toTaskSkill), [query.data]);

	return {
		...query,
		taskSkills,
	};
}

export function useSkillQuery(slug: string, projectName?: string, options?: { enabled?: boolean }) {
	const query = useQuery({
		...orpc.skills.get.queryOptions({ input: { slug, projectName } }),
		enabled: options?.enabled ?? true,
	});
	const skill = useMemo(() => (query.data ? toTaskSkill(query.data) : null), [query.data]);
	const variants = query.data?.variants ?? [];

	return {
		...query,
		skill,
		variants,
	};
}
