import { Label } from "@/components/ui/label";

import { SkillCard } from "@/routes/_app/tarefas/$taskId/-components/skill-card";
import type { TaskSkill } from "@/types/skills";

type SkillPreviewPanelProps = {
	skill: TaskSkill;
};

export function SkillPreviewPanel({ skill }: SkillPreviewPanelProps) {
	return (
		<div className="space-y-2">
			<Label>Preview</Label>
			<div className="rounded-md border border-border bg-background p-2">
				<SkillCard skill={skill} variant="manage" disabled />
			</div>
		</div>
	);
}
