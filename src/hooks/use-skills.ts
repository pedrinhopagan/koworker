import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { orpc } from "@/client";
import { useSkillCategoriesQuery } from "@/hooks/use-skill-categories";
import { deriveSkillColor } from "@/lib/skill-color";
import type { SkillRecord, TaskSkill } from "@/types/skills";

const DEFAULT_SKILL_ICON = "FolderOpen";
const DEFAULT_SKILL_COLOR = "#94a3b8";

function toTaskSkill(skill: SkillRecord, categoryColors: Map<string, string>): TaskSkill {
	const metadata = (skill.metadata ?? {}) as Record<string, unknown>;
	const metadataIcon = typeof metadata.icon === "string" ? metadata.icon : undefined;
	const metadataColor = typeof metadata.color === "string" ? metadata.color : undefined;
	const requiresSubtaskSelection =
		metadata.multiSelect === true || metadata.requiresSubtaskSelection === true;

	const categoryColor = skill.settings.categoryId
		? categoryColors.get(skill.settings.categoryId)
		: undefined;
	const categoryTone = categoryColor ? deriveSkillColor(categoryColor, skill.slug) : undefined;

	return {
		id: skill.slug,
		slug: skill.slug,
		label: skill.settings.label ?? skill.name,
		description: skill.description,
		instructions: skill.content,
		icon: skill.settings.icon ?? metadataIcon ?? DEFAULT_SKILL_ICON,
		color: skill.settings.color ?? metadataColor ?? categoryTone ?? DEFAULT_SKILL_COLOR,
		categoryId: skill.settings.categoryId ?? null,
		quickInvoke: skill.settings.quickInvoke,
		sources: skill.sources,
		conflict: skill.conflict,
		primaryPath: skill.primaryPath,
		primaryDir: skill.primaryDir,
		metadata,
		requiresSubtaskSelection,
	};
}

function useCategoryColors() {
	const categoriesQuery = useSkillCategoriesQuery();
	return useMemo(
		() => new Map((categoriesQuery.data ?? []).map((category) => [category.id, category.color])),
		[categoriesQuery.data],
	);
}

export function useSkillsQuery(projectName?: string, options?: { enabled?: boolean }) {
	const query = useQuery({
		...orpc.skills.list.queryOptions({ input: { projectName } }),
		enabled: options?.enabled ?? true,
	});
	const categoryColors = useCategoryColors();
	const taskSkills = useMemo(
		() => (query.data ?? []).map((record) => toTaskSkill(record, categoryColors)),
		[query.data, categoryColors],
	);

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
	const categoryColors = useCategoryColors();
	const skill = useMemo(
		() => (query.data ? toTaskSkill(query.data, categoryColors) : null),
		[query.data, categoryColors],
	);
	const variants = query.data?.variants ?? [];
	const missingTools = query.data?.missingTools ?? [];

	return {
		...query,
		skill,
		variants,
		missingTools,
	};
}
