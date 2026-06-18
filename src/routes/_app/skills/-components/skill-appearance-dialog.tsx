import { Dialog } from "@/components/ui/dialog";
import type { SkillCategory, TaskSkill } from "@/types/skills";
import { useSkillSettingsMutation } from "../-utils/use-skill-settings";
import { SkillAppearanceControls } from "./skill-appearance-controls";

// Dialog de aparência e categoria aberto pela engrenagem do card no grid — mesmo controle do popover
// da página de detalhe, salvando direto em `skill_settings` via mutation.
export function SkillAppearanceDialog({
	skill,
	categories,
	onClose,
}: {
	skill: TaskSkill | null;
	categories: SkillCategory[];
	onClose: () => void;
}) {
	const settingsMutation = useSkillSettingsMutation();

	return (
		<Dialog
			open={skill !== null}
			onClose={onClose}
			title="Aparência e categoria"
			description="Ícone, cor e categoria são metadados do koworker e não alteram o arquivo da skill."
			className="max-w-sm"
		>
			{skill ? (
				<div className="px-5 py-4">
					<SkillAppearanceControls
						slug={skill.slug}
						label={skill.label}
						icon={skill.icon}
						color={skill.color}
						categoryId={skill.categoryId}
						quickInvoke={skill.quickInvoke}
						categories={categories}
						onChange={(settings) => settingsMutation.mutate(settings)}
					/>
				</div>
			) : null}
		</Dialog>
	);
}
