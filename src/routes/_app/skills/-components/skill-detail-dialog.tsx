import { SlidersHorizontal } from "lucide-react";

import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Dialog } from "@/components/ui/dialog";
import { LucideIcon } from "@/lib/lucide-icon";
import type { SkillSource, TaskSkill } from "@/types/skills";

const TOOL_LABEL: Record<SkillSource["tool"], string> = {
	opencode: "opencode",
	"claude-code": "Claude Code",
	codex: "Codex",
	agents: "Agents",
	koworker: "Koworker",
};

type SkillDetailDialogProps = {
	skill: TaskSkill | null;
	onClose: () => void;
	onEdit: () => void;
};

export function SkillDetailDialog({ skill, onClose, onEdit }: SkillDetailDialogProps) {
	return (
		<Dialog
			open={!!skill}
			onClose={onClose}
			title={skill?.label ?? ""}
			description={skill?.slug}
			className="max-w-2xl"
			footer={
				<Button type="button" variant="outline" size="sm" onClick={onEdit}>
					<SlidersHorizontal className="h-4 w-4" />
					Editar aparência
				</Button>
			}
		>
			{skill && (
				<div className="space-y-5">
					<div className="flex items-start gap-3">
						<div
							className="flex h-11 w-11 shrink-0 items-center justify-center border"
							style={{ borderColor: skill.color, color: skill.color }}
						>
							<LucideIcon name={skill.icon} className="size-5" />
						</div>
						<div className="min-w-0 space-y-2">
							<Text size="sm">{skill.description}</Text>
							<div className="flex flex-wrap gap-1">
								{skill.sources.map((source) => (
									<Chip
										key={`${source.tool}-${source.scope}`}
										size="xs"
										variant={source.tool === "koworker" ? "primary" : "outline"}
									>
										{TOOL_LABEL[source.tool]}
										{source.scope === "project" ? " · projeto" : ""}
									</Chip>
								))}
							</div>
						</div>
					</div>

					<div className="space-y-2">
						<div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
							Conteúdo
						</div>
						{skill.instructions.trim() ? (
							<pre className="overflow-auto border border-border bg-muted/30 p-4 text-xs whitespace-pre-wrap font-mono leading-relaxed">
								{skill.instructions}
							</pre>
						) : (
							<Text size="sm" tone="muted">
								Sem conteúdo
							</Text>
						)}
					</div>
				</div>
			)}
		</Dialog>
	);
}
