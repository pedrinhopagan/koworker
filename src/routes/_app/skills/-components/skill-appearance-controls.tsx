import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

import { Text } from "@/components/typography";
import { CustomSelect } from "@/components/ui/custom-select";
import { IconSelector } from "@/components/ui/icon-selector";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { LucideIcon } from "@/lib/lucide-icon";
import { cn } from "@/lib/utils";
import type { SkillCategory } from "@/types/skills";

type SkillAppearanceChange = {
	slug: string;
	icon?: string;
	color?: string;
	categoryId?: string | null;
	quickInvoke?: boolean;
};

// Id sentinela da opção "Sem categoria"; o CustomSelect exige um id de string por item, então a
// ausência de categoria precisa de um valor próprio em vez de "".
const NO_CATEGORY_ID = "__none__";

// Controles de aparência e categoria da skill (preview + ícone + cor + categoria) — metadados
// internos em `skill_settings`, não tocam o arquivo. Ícone aplica direto (escolha discreta); cor
// mantém rascunho local pro preview ao vivo e grava no blur pra não disparar a cada passo do seletor
// de cor. Compartilhado entre o Popover (página de detalhe) e o Dialog (grid).
export function SkillAppearanceControls({
	slug,
	label,
	icon,
	color,
	categoryId,
	quickInvoke,
	categories,
	onChange,
}: {
	slug: string;
	label: string;
	icon: string;
	color: string;
	categoryId: string | null;
	quickInvoke: boolean;
	categories: SkillCategory[];
	onChange: (settings: SkillAppearanceChange) => void;
}) {
	const [draftColor, setDraftColor] = useState(color);

	useEffect(() => setDraftColor(color), [color]);

	const categoryItems = [
		{ id: NO_CATEGORY_ID, name: "Sem categoria", color: "#6b7280" },
		...categories.map((category) => ({
			id: category.id,
			name: category.name,
			color: category.color,
		})),
	];
	const selectedCategory = categories.find((category) => category.id === categoryId) ?? null;

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

			<div className="space-y-2">
				<Label>Categoria</Label>
				<CustomSelect
					items={categoryItems}
					value={categoryId ?? NO_CATEGORY_ID}
					onValueChange={(value) =>
						onChange({ slug, categoryId: value === NO_CATEGORY_ID ? null : value })
					}
					renderTrigger={() => (
						<>
							<span className="flex min-w-0 items-center gap-2">
								<span
									className={cn(
										"size-2 shrink-0 rounded-full",
										!selectedCategory && "bg-muted-foreground",
									)}
									style={selectedCategory ? { backgroundColor: selectedCategory.color } : undefined}
								/>
								<span className="truncate">{selectedCategory?.name ?? "Sem categoria"}</span>
							</span>
							<ChevronDown className="ml-1 size-4 text-muted-foreground" />
						</>
					)}
					renderItem={(item, isSelected) => (
						<div
							className={cn(
								"flex w-full items-center gap-2 px-3 py-2",
								isSelected && "font-medium",
							)}
						>
							<span
								className="size-2 shrink-0 rounded-full"
								style={{ backgroundColor: item.color }}
							/>
							<span className="truncate">{item.name}</span>
						</div>
					)}
					label="Categoria"
					triggerClassName="w-full bg-background"
				/>
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
