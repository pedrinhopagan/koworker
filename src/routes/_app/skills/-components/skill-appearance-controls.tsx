import { useEffect, useState } from "react";

import { Text } from "@/components/typography";
import { IconSelector } from "@/components/ui/icon-selector";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { LucideIcon } from "@/lib/lucide-icon";

type SkillAppearanceChange = {
	slug: string;
	icon?: string;
	color?: string;
	quickInvoke?: boolean;
};

// Controles de aparência da skill (preview + ícone + cor + invocação rápida) — metadados internos em
// `skill_settings`, não tocam o arquivo. Categoria mora fora daqui (no menu da engrenagem). Ícone
// aplica direto; cor mantém rascunho local pro preview ao vivo e grava no blur pra não disparar a
// cada passo do seletor de cor.
export function SkillAppearanceControls({
	slug,
	label,
	icon,
	color,
	quickInvoke,
	onChange,
}: {
	slug: string;
	label: string;
	icon: string;
	color: string;
	quickInvoke: boolean;
	onChange: (settings: SkillAppearanceChange) => void;
}) {
	const [draftColor, setDraftColor] = useState(color);

	useEffect(() => setDraftColor(color), [color]);

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-3 border border-border bg-card p-3">
				<div
					className="flex h-10 w-10 shrink-0 items-center justify-center border"
					style={{ borderColor: draftColor, color: draftColor }}
				>
					<LucideIcon name={icon} className="size-5" />
				</div>
				<div className="min-w-0">
					<div className="truncate font-display text-sm font-semibold">{label}</div>
					<Text size="xs" tone="muted" className="truncate font-mono">
						{slug}
					</Text>
				</div>
			</div>

			<div className="grid grid-cols-[1fr_88px] gap-3">
				<div className="space-y-2">
					<Label>Ícone</Label>
					<IconSelector
						value={icon}
						onChange={(value) => onChange({ slug, icon: value })}
						className="h-9 w-full"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="skill-color">Cor</Label>
					<Input
						id="skill-color"
						type="color"
						value={draftColor}
						onChange={(event) => setDraftColor(event.target.value)}
						onBlur={() => draftColor !== color && onChange({ slug, color: draftColor })}
						className="h-9 w-full p-1"
					/>
				</div>
			</div>

			<label className="flex cursor-pointer items-start justify-between gap-3 border border-border bg-card p-3">
				<span className="min-w-0">
					<span className="block text-sm font-medium">Invocação rápida</span>
					<Text size="xs" tone="muted">
						Aparece no picker de skill do prompt bar, para disparar /{slug} numa nova aba.
					</Text>
				</span>
				<Switch
					checked={quickInvoke}
					onCheckedChange={(checked) => onChange({ slug, quickInvoke: checked })}
				/>
			</label>
		</div>
	);
}
