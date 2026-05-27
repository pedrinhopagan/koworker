import { Label } from "@/components/ui/label";
import type { TaskSkill } from "@/types/skills";

type SkillPreviewPanelProps = {
	skill: TaskSkill;
};

export function SkillPreviewPanel({ skill }: SkillPreviewPanelProps) {
	return (
		<div className="space-y-2">
			<Label>Preview</Label>
			<div className="flex items-start gap-3 rounded-md border border-border bg-background p-3">
				<span
					className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded text-sm"
					style={{ backgroundColor: `${skill.color}20`, color: skill.color }}
				>
					{skill.icon}
				</span>
				<div className="min-w-0 space-y-0.5">
					<p className="truncate text-sm font-medium">{skill.label}</p>
					<p className="text-xs text-muted-foreground">{skill.description}</p>
				</div>
			</div>
		</div>
	);
}
