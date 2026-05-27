import { useEffect, useState } from "react";

import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { IconSelector } from "@/components/ui/icon-selector";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LucideIcon } from "@/lib/lucide-icon";
import type { TaskSkill } from "@/types/skills";
import { useSkillSettingsMutation } from "../-utils/use-skill-settings";

type SkillSettingsDialogProps = {
	skill: TaskSkill | null;
	onClose: () => void;
};

export function SkillSettingsDialog({ skill, onClose }: SkillSettingsDialogProps) {
	const [label, setLabel] = useState("");
	const [icon, setIcon] = useState("");
	const [color, setColor] = useState("");

	useEffect(() => {
		if (!skill) return;
		setLabel(skill.label);
		setIcon(skill.icon);
		setColor(skill.color);
	}, [skill]);

	const mutation = useSkillSettingsMutation();

	const isDirty =
		!!skill && (label !== skill.label || icon !== skill.icon || color !== skill.color);
	const canSave = isDirty && label.trim() !== "";

	function handleSave() {
		if (!skill) return;
		mutation.mutate({ slug: skill.slug, label, icon, color }, { onSuccess: onClose });
	}

	return (
		<Dialog
			open={!!skill}
			onClose={onClose}
			title="Aparência"
			description="Metadados internos · não alteram o arquivo da skill"
			footer={
				<>
					<Button type="button" variant="outline" size="sm" onClick={onClose}>
						Cancelar
					</Button>
					<Button
						type="button"
						size="sm"
						onClick={handleSave}
						disabled={!canSave || mutation.isPending}
					>
						{mutation.isPending ? "Salvando..." : "Salvar"}
					</Button>
				</>
			}
		>
			<div className="space-y-5">
				<div className="flex items-center gap-3 border border-border bg-card p-3">
					<div
						className="flex h-12 w-12 shrink-0 items-center justify-center border"
						style={{ borderColor: color, color }}
					>
						<LucideIcon name={icon} className="size-6" />
					</div>
					<div className="min-w-0">
						<div className="truncate font-display text-sm font-semibold">
							{label.trim() || "Sem nome"}
						</div>
						{skill && (
							<Text size="xs" tone="muted" className="font-mono truncate">
								{skill.slug}
							</Text>
						)}
					</div>
				</div>

				<div className="space-y-2">
					<Label htmlFor="skill-label">Nome de exibição</Label>
					<Input
						id="skill-label"
						value={label}
						onChange={(event) => setLabel(event.target.value)}
						className="w-full"
					/>
				</div>

				<div className="grid grid-cols-[1fr_120px] gap-4">
					<div className="space-y-2">
						<Label>Ícone</Label>
						<IconSelector value={icon} onChange={setIcon} className="h-9 w-full" />
					</div>
					<div className="space-y-2">
						<Label htmlFor="skill-color">Cor</Label>
						<Input
							id="skill-color"
							type="color"
							value={color}
							onChange={(event) => setColor(event.target.value)}
							className="h-9 w-full p-1"
						/>
					</div>
				</div>
			</div>
		</Dialog>
	);
}
