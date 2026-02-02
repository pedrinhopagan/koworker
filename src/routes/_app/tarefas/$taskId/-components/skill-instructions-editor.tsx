import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";

import { getCustomInstructions, setCustomInstructions } from "./build-prompt";
import { getSkillById, type SkillId } from "./skill-registry";

type SkillInstructionsEditorProps = {
	skillId: SkillId | null;
	onClose: () => void;
};

export function SkillInstructionsEditor({ skillId, onClose }: SkillInstructionsEditorProps) {
	const skill = skillId ? getSkillById(skillId) : null;
	const [instructions, setInstructions] = useState("");
	const [hasChanges, setHasChanges] = useState(false);

	useEffect(() => {
		if (!skillId || !skill) {
			setInstructions("");
			setHasChanges(false);
			return;
		}

		const custom = getCustomInstructions(skillId);
		setInstructions(custom ?? skill.instructions);
		setHasChanges(false);
	}, [skillId, skill]);

	function handleChange(value: string) {
		setInstructions(value);
		setHasChanges(true);
	}

	function handleSave() {
		if (!skillId) return;
		setCustomInstructions(skillId, instructions);
		setHasChanges(false);
		onClose();
	}

	function handleReset() {
		if (!skillId || !skill) return;
		setInstructions(skill.instructions);
		setCustomInstructions(skillId, "");
		setHasChanges(true);
	}

	function handleClose() {
		if (hasChanges) {
			const confirm = window.confirm("Você tem alterações não salvas. Deseja sair mesmo assim?");
			if (!confirm) return;
		}
		onClose();
	}

	return (
		<Drawer
			open={skillId !== null}
			onClose={handleClose}
			title={skill ? `Editar instruções: ${skill.label}` : "Editar instruções"}
			description="Personalize as instruções que serão enviadas ao agente"
		>
			<div className="flex flex-col gap-4 h-full">
				<div className="flex-1 flex flex-col gap-2">
					<div className="flex items-center justify-between">
						<Text size="xs" tone="muted" className="uppercase tracking-wide">
							Instruções
						</Text>
						<Button variant="ghost" size="sm" onClick={handleReset} className="h-7 text-xs">
							<RotateCcw size={12} />
							Restaurar padrão
						</Button>
					</div>
					<Textarea
						value={instructions}
						onChange={(e) => handleChange(e.target.value)}
						placeholder="Instruções para o agente..."
						className="flex-1 min-h-[300px] font-mono text-xs"
					/>
				</div>

				<div className="flex gap-2 justify-end border-t border-border pt-4">
					<Button variant="outline" onClick={handleClose}>
						Cancelar
					</Button>
					<Button onClick={handleSave} disabled={!hasChanges}>
						Salvar
					</Button>
				</div>
			</div>
		</Drawer>
	);
}
