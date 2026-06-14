import { useEffect, useState } from "react";

import { Text } from "@/components/typography";
import { IconSelector } from "@/components/ui/icon-selector";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LucideIcon } from "@/lib/lucide-icon";

type AgentAppearanceChange = { slug: string; icon?: string; color?: string };

// Controles de aparência do agent (preview + ícone + cor) — metadados internos em `agent_settings`,
// não tocam o arquivo. Ícone aplica direto (escolha discreta); cor mantém rascunho local pro
// preview ao vivo e grava no blur pra não disparar a cada passo do seletor de cor. Compartilhado
// entre o Popover (página de detalhe) e o Dialog (grid).
export function AgentAppearanceControls({
	slug,
	label,
	icon,
	color,
	onChange,
}: {
	slug: string;
	label: string;
	icon: string;
	color: string;
	onChange: (settings: AgentAppearanceChange) => void;
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
					<Label htmlFor="agent-color">Cor</Label>
					<Input
						id="agent-color"
						type="color"
						value={draftColor}
						onChange={(event) => setDraftColor(event.target.value)}
						onBlur={() => draftColor !== color && onChange({ slug, color: draftColor })}
						className="h-9 w-full p-1"
					/>
				</div>
			</div>
		</div>
	);
}
