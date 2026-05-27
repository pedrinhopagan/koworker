import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Book } from "lucide-react";
import { useMemo, useState } from "react";
import { orpc } from "@/client";
import { PageShell } from "@/components/layout/page-shell";
import { useSkillsQuery } from "@/hooks/use-skills";
import { useSelectedProjectStore } from "@/stores/selected-project";
import { SkillDetailDialog } from "./-components/skill-detail-dialog";
import { SkillSettingsDialog } from "./-components/skill-settings-dialog";
import { SkillsGrid } from "./-components/skills-grid";

export const Route = createFileRoute("/_app/skills/")({
	component: SkillsPage,
});

function SkillsPage() {
	const [detailSlug, setDetailSlug] = useState<string | null>(null);
	const [settingsSlug, setSettingsSlug] = useState<string | null>(null);

	const selectedProjectId = useSelectedProjectStore((state) => state.selectedProjectId);
	const projectsQuery = useQuery(orpc.projects.list.queryOptions());
	const projectName = useMemo(() => {
		if (!selectedProjectId) return;
		return projectsQuery.data?.find((project) => project.id === selectedProjectId)?.name;
	}, [selectedProjectId, projectsQuery.data]);

	const skillsQuery = useSkillsQuery(projectName);
	const taskSkills = skillsQuery.taskSkills;

	const detailSkill = useMemo(
		() => taskSkills.find((skill) => skill.slug === detailSlug) ?? null,
		[taskSkills, detailSlug],
	);
	const settingsSkill = useMemo(
		() => taskSkills.find((skill) => skill.slug === settingsSlug) ?? null,
		[taskSkills, settingsSlug],
	);

	return (
		<PageShell
			title="Skills"
			description="Skills encontradas nas pastas do opencode, Claude Code, Codex e Agents"
			icon={Book}
		>
			<div className="h-full min-h-0 pb-4">
				<SkillsGrid
					skills={taskSkills}
					loading={skillsQuery.isLoading}
					onView={setDetailSlug}
					onEdit={setSettingsSlug}
				/>
			</div>

			<SkillDetailDialog
				skill={detailSkill}
				onClose={() => setDetailSlug(null)}
				onEdit={() => {
					setSettingsSlug(detailSlug);
					setDetailSlug(null);
				}}
			/>

			<SkillSettingsDialog skill={settingsSkill} onClose={() => setSettingsSlug(null)} />
		</PageShell>
	);
}
