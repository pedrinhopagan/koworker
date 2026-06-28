import { ChevronDown, Cpu, Gauge } from "lucide-react";

import { CustomSelect } from "@/components/ui/custom-select";
import { Tooltip } from "@/components/ui/tooltip";
import {
	INVOKE_EFFORT_OPTIONS,
	INVOKE_INHERIT,
	INVOKE_MODEL_OPTIONS,
	type InvokeOption,
	reflectValue,
} from "@/constants/invoke";

type Metadata = Record<string, unknown>;

function readStr(value: unknown): string {
	if (value === null || value === undefined || typeof value === "object") return "";
	return String(value);
}

// Padrão = ausência da chave. Escolher "padrão" limpa o frontmatter (igual ao toggle dos booleanos);
// qualquer outro valor grava explícito. É o que a pré-seleção do painel de invocação lê de volta.
function setDefault(metadata: Metadata, key: string, value: string): Metadata {
	const next = { ...metadata };
	if (value === INVOKE_INHERIT) delete next[key];
	else next[key] = value;
	return next;
}

// Modelo e esforço padrão de uma skill/agent, lado a lado no cabeçalho. Mesmas opções do painel de
// invocação (fonte única em constants/invoke), então o que se escolhe aqui é exatamente o que
// pré-seleciona ao clicar o alvo lá. Um valor fora da lista (ID de modelo completo) vira um item
// extra selecionado pra refletir o arquivo fielmente.
export function InvokeDefaultsControl({
	metadata,
	onChange,
}: {
	metadata: Metadata;
	onChange: (next: Metadata) => void;
}) {
	return (
		<div className="flex shrink-0 items-center gap-1">
			<DefaultSelect
				icon={Cpu}
				ariaLabel="Modelo padrão"
				value={readStr(metadata.model) || INVOKE_INHERIT}
				options={INVOKE_MODEL_OPTIONS}
				onChange={(value) => onChange(setDefault(metadata, "model", value))}
			/>
			<DefaultSelect
				icon={Gauge}
				ariaLabel="Esforço padrão"
				value={readStr(metadata.effort) || INVOKE_INHERIT}
				options={INVOKE_EFFORT_OPTIONS}
				onChange={(value) => onChange(setDefault(metadata, "effort", value))}
			/>
		</div>
	);
}

function DefaultSelect({
	icon: Icon,
	ariaLabel,
	value,
	options,
	onChange,
}: {
	icon: typeof Cpu;
	ariaLabel: string;
	value: string;
	options: InvokeOption[];
	onChange: (value: string) => void;
}) {
	const segments = reflectValue(options, value).map((option) => ({
		id: option.value,
		label: option.label,
		hint: option.hint,
	}));
	const active = segments.find((option) => option.id === value);

	return (
		<Tooltip label={active?.hint ?? ariaLabel}>
			<CustomSelect
				items={segments}
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
