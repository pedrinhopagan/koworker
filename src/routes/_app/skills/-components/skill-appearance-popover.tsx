import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { type SkillAppearanceChange, SkillAppearanceControls } from "./skill-appearance-controls";

export function SkillAppearancePopover({
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
	onChange: (settings: SkillAppearanceChange) => void;
}) {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button type="button" variant="outline" size="sm">
					<SlidersHorizontal className="size-3.5" />
					Aparência
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-72 p-4">
				<SkillAppearanceControls
					slug={slug}
					label={label}
					icon={icon}
					color={color}
					onChange={onChange}
				/>
			</PopoverContent>
		</Popover>
	);
}
