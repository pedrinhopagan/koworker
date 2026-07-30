import { createFileRoute } from "@tanstack/react-router";
import { Book } from "lucide-react";
import { z } from "zod";

import { PageShell } from "@/components/layout/page-shell";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { useSkillCategoriesQuery } from "@/hooks/use-skill-categories";
import { useSkillsQuery } from "@/hooks/use-skills";
import { SkillsGrid } from "./-components/skills-grid";
import { SkillsSyncAction } from "./-components/skills-sync-dialog";

const searchSchema = z.object({
	searchQuery: z.string().optional(),
});

export const Route = createFileRoute("/_app/skills/")({
	component: SkillsPage,
	validateSearch: searchSchema,
});

function SkillsPage() {
	const { selectedProject } = useProjectFocus();
	const skillsQuery = useSkillsQuery(selectedProject?.name);
	const categoriesQuery = useSkillCategoriesQuery();
	const navigate = Route.useNavigate();
	const { searchQuery } = Route.useSearch();

	return (
		<PageShell
			title="Skills"
			description="Skills encontradas nas pastas do opencode, Claude Code, Codex e Agents"
			icon={Book}
			actions={<SkillsSyncAction />}
		>
			<div className="h-full min-h-0 pb-4">
				<SkillsGrid
					skills={skillsQuery.taskSkills}
					categories={categoriesQuery.data ?? []}
					loading={skillsQuery.isLoading}
					search={searchQuery ?? ""}
					onSearchChange={(value) => {
						void navigate({
							search: (previous) => ({
								...previous,
								searchQuery: value.length > 0 ? value : undefined,
							}),
							replace: true,
						});
					}}
				/>
			</div>
		</PageShell>
	);
}
