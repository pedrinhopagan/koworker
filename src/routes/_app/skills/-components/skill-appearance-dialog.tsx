import { Dialog } from "@/components/ui/dialog";
import type { TaskSkill } from "@/types/skills";
import { useSkillSettingsMutation } from "../-utils/use-skill-settings";
import { SkillAppearanceControls } from "./skill-appearance-controls";

// Dialog de aparência aberto pela engrenagem do card no grid — mesmo controle do popover da página
// de detalhe, salvando direto em `skill_settings` via mutation.
export function SkillAppearanceDialog({
	skill,
	onClose,
}: {
	skill: TaskSkill | null;
	onClose: () => void;
}) {
	const settingsMutation = useSkillSettingsMutation();

	return (
		<Dialog
			open={skill !== null}
			onClose={onClose}
			title="Aparência da skill"
			description="Ícone e cor são metadados do koworker e não alteram o arquivo da skill."
			className="max-w-sm"
		>
			{skill ? (
				<div className="px-5 py-4">
					<SkillAppearanceControls
						slug={skill.slug}
						label={skill.label}
						icon={skill.icon}
						color={skill.color}
						onChange={(settings) => settingsMutation.mutate(settings)}
					/>
				</div>
			) : null}
		</Dialog>
	);
}
