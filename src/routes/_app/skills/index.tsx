import { createFileRoute } from "@tanstack/react-router";
import { Book } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { useSkillsQuery } from "@/hooks/use-skills";
import { SkillsGrid } from "./-components/skills-grid";

export const Route = createFileRoute("/_app/skills/")({
	component: SkillsPage,
});

function SkillsPage() {
	const { selectedProject } = useProjectFocus();
	const skillsQuery = useSkillsQuery(selectedProject?.name);

	return (
		<PageShell
			title="Skills"
			description="Skills encontradas nas pastas do opencode, Claude Code, Codex e Agents"
			icon={Book}
		>
			<div className="h-full min-h-0 pb-4">
				<SkillsGrid skills={skillsQuery.taskSkills} loading={skillsQuery.isLoading} />
			</div>
		</PageShell>
	);
}
