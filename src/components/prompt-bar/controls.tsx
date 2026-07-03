import { ChevronDown, type LucideIcon } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { CustomSelect } from "@/components/ui/custom-select";
import { Tooltip } from "@/components/ui/tooltip";
import { type InvokeOption, reflectValue } from "@/constants/invoke";
import { cn } from "@/lib/utils";

// Peças compartilhadas do prompt-bar: rótulo de grupo, chip de toggle e select compacto — usadas pela
// linha de anexar sempre visível, pelo painel de anexos e pelo painel de invocação.

export function GroupLabel({ children }: { children: React.ReactNode }) {
	return (
		<span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/60">
			{children}
		</span>
	);
}

// Botão-chip de toggle: checkbox e rótulo num bloco bordado clicável inteiro. Ativo ganha realce
// primário; o `<label>` faz o clique em qualquer ponto do chip alternar a checkbox.
export function ToggleBox({
	label,
	hint,
	checked,
	disabled,
	onChange,
}: {
	label: string;
	hint: string;
	checked: boolean;
	disabled?: boolean;
	onChange: (value: boolean) => void;
}) {
	return (
		<Tooltip label={hint}>
			<label
				className={cn(
					"flex h-7 shrink-0 cursor-pointer select-none items-center gap-1.5 border px-2 text-xs transition-colors",
					checked
						? "border-primary/40 bg-primary/10 text-foreground"
						: "border-border bg-card text-muted-foreground hover:border-muted-foreground hover:text-foreground",
					disabled &&
						"cursor-not-allowed opacity-40 hover:border-border hover:text-muted-foreground",
				)}
			>
				<Checkbox
					size="sm"
					checked={checked}
					disabled={disabled}
					onCheckedChange={(value) => onChange(value === true)}
				/>
				{label}
			</label>
		</Tooltip>
	);
}

export function MiniSelect({
	icon: Icon,
	value,
	onChange,
	options,
}: {
	icon: LucideIcon;
	value: string;
	onChange: (value: string) => void;
	options: InvokeOption[];
}) {
	const items = reflectValue(options, value).map((option) => ({
		id: option.value,
		label: option.label,
		hint: option.hint,
	}));
	const active = items.find((option) => option.id === value);

	return (
		<Tooltip label={active?.hint ?? ""}>
			<CustomSelect
				items={items}
				value={value}
				onValueChange={(next) => onChange(next)}
				size="sm"
				fitContent
				triggerClassName="gap-1.5 px-2"
				renderTrigger={() => (
					<>
						<Icon className="size-3.5 shrink-0 text-muted-foreground" />
						<span className="truncate text-left text-xs">{active?.label ?? ""}</span>
						<ChevronDown className="size-3.5 shrink-0 opacity-50" />
					</>
				)}
				renderItem={(option) => <span className="text-xs">{option.label}</span>}
			/>
		</Tooltip>
	);
}
