import { Info, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import {
	AGENT_BOOLEAN_FIELDS,
	AGENT_KNOWN_METADATA_KEYS,
	AGENT_STRING_FIELDS,
	type AgentStringField,
} from "@/constants/agents";
import { cn } from "@/lib/utils";

type Metadata = Record<string, unknown>;

// Parser solto (parseFrontmatterLoose) devolve string quando o YAML estrito falha, então um
// booleano pode chegar como "true"/"false". Normaliza ambos.
function readBool(value: unknown, fallback: boolean): boolean {
	if (value === true || value === "true") return true;
	if (value === false || value === "false") return false;
	return fallback;
}

function readStr(value: unknown): string {
	if (Array.isArray(value)) return value.join(", ");
	if (value === null || value === undefined || typeof value === "object") return "";
	return String(value);
}

function isBoolLike(value: unknown): boolean {
	return value === true || value === false || value === "true" || value === "false";
}

function setString(metadata: Metadata, key: string, value: string): Metadata {
	const next = { ...metadata };
	const trimmed = value.trim();
	if (trimmed) next[key] = trimmed;
	else delete next[key];
	return next;
}

// Chaves de metadado que não conhecemos nem tratamos em outro lugar: aparecem genéricas pra que
// "todas as possíveis metadata" caibam — booleanas viram switch, o resto vira campo de texto.
function extraKeys(metadata: Metadata, kind: "bool" | "string"): string[] {
	return Object.keys(metadata)
		.filter((key) => !AGENT_KNOWN_METADATA_KEYS.has(key))
		.filter((key) => (kind === "bool" ? isBoolLike(metadata[key]) : !isBoolLike(metadata[key])))
		.filter(
			(key) => kind === "string" || readStr(metadata[key]) === "" || isBoolLike(metadata[key]),
		)
		.sort();
}

// Rótulo com mini-guia: ícone de info ao lado do título mostra o texto explicativo no hover.
function FieldLabel({ label, help }: { label: string; help?: string }) {
	return (
		<div className="flex items-center gap-1">
			<Text size="xs" tone="muted">
				{label}
			</Text>
			{help ? (
				<Tooltip label={<span className="block max-w-56 leading-snug">{help}</span>}>
					<Info className="size-3 cursor-help text-muted-foreground/60" />
				</Tooltip>
			) : null}
		</div>
	);
}

// Radio de valor único pros campos com `options` (modelo). Reflete o arquivo fielmente: um valor
// armazenado fora da lista (ex.: ID de modelo completo) vira um segmento extra selecionado.
// Reclicar o segmento ativo limpa a chave; `clearOn` (inherit) também limpa.
function RadioField({
	field,
	value,
	onCommit,
}: {
	field: AgentStringField;
	value: string;
	onCommit: (value: string) => void;
}) {
	const options = field.options ?? [];
	const extra = value && !options.includes(value) ? value : null;
	const segments = extra ? [...options, extra] : options;

	const isSelected = (option: string) => {
		if (value) return option === value;
		return option === field.clearOn;
	};

	const select = (option: string) => {
		if (option === value || option === field.clearOn) onCommit("");
		else onCommit(option);
	};

	return (
		<div className="flex flex-col gap-1.5">
			<FieldLabel label={field.label} help={field.help} />
			<div className="flex flex-wrap gap-1">
				{segments.map((option) => (
					<button
						key={option}
						type="button"
						onClick={() => select(option)}
						className={cn(
							"rounded border px-2 py-0.5 text-xs transition-colors",
							isSelected(option)
								? "border-primary bg-primary/10 text-foreground"
								: "border-border text-muted-foreground hover:bg-secondary",
						)}
					>
						{option}
					</button>
				))}
			</div>
		</div>
	);
}

function StringField({
	label,
	placeholder,
	help,
	value,
	onCommit,
}: {
	label: string;
	placeholder: string;
	help?: string;
	value: string;
	onCommit: (value: string) => void;
}) {
	const [draft, setDraft] = useState(value);

	// Re-semeia quando a variante ativa muda (o pai passa o metadata da nova cópia).
	useEffect(() => setDraft(value), [value]);

	return (
		<label className="flex flex-col gap-1">
			<FieldLabel label={label} help={help} />
			<Input
				value={draft}
				placeholder={placeholder}
				onChange={(event) => setDraft(event.target.value)}
				onBlur={() => {
					if (draft !== value) onCommit(draft);
				}}
				className="h-8 text-sm"
			/>
		</label>
	);
}

function Divider() {
	return <div className="h-px bg-border" />;
}

// Editor de metadados do frontmatter, todo dentro de um popover (gatilho ao lado de "Aparência").
// Radios pra modelo e campos de texto com mini-guia pro resto. Cada mudança grava direto no arquivo
// da variante ativa via `onChange`.
export function AgentMetadataControls({
	metadata,
	onChange,
}: {
	metadata: Metadata;
	onChange: (next: Metadata) => void;
}) {
	const extraBools = extraKeys(metadata, "bool");
	const extraStrings = extraKeys(metadata, "string");
	const selectFields = AGENT_STRING_FIELDS.filter((field) => field.options);
	const textFields = AGENT_STRING_FIELDS.filter((field) => !field.options);
	const hasInvocation = AGENT_BOOLEAN_FIELDS.length > 0 || extraBools.length > 0;

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button type="button" variant="outline" size="sm" className="shrink-0">
					<Settings2 className="size-3.5" />
					Metadados
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				collisionPadding={{ right: 16 }}
				className="max-h-[70vh] w-80 overflow-y-auto p-4"
			>
				<div className="flex flex-col gap-3">
					{hasInvocation ? (
						<>
							<Text size="xs" tone="muted" className="font-medium uppercase tracking-wide">
								Invocação
							</Text>
							{AGENT_BOOLEAN_FIELDS.map((field) => (
								<div key={field.key} className="flex items-start justify-between gap-3">
									<div className="flex min-w-0 flex-col">
										<Text size="sm">{field.label}</Text>
										<Text size="xs" tone="muted" className="leading-snug">
											{field.help}
										</Text>
									</div>
									<Switch
										size="sm"
										checked={readBool(metadata[field.key], field.default)}
										onCheckedChange={(value) =>
											onChange(
												value === field.default
													? omitKey(metadata, field.key)
													: { ...metadata, [field.key]: value },
											)
										}
									/>
								</div>
							))}
							{extraBools.map((key) => (
								<div key={key} className="flex items-center justify-between gap-3">
									<Text size="sm" className="min-w-0 truncate font-mono">
										{key}
									</Text>
									<Switch
										size="sm"
										checked={readBool(metadata[key], false)}
										onCheckedChange={(value) => onChange({ ...metadata, [key]: value })}
									/>
								</div>
							))}

							<Divider />
						</>
					) : null}

					{selectFields.map((field) => (
						<RadioField
							key={field.key}
							field={field}
							value={readStr(metadata[field.key])}
							onCommit={(value) => onChange(setString(metadata, field.key, value))}
						/>
					))}

					<Divider />

					{textFields.map((field) => (
						<StringField
							key={field.key}
							label={field.label}
							placeholder={field.placeholder}
							help={field.help}
							value={readStr(metadata[field.key])}
							onCommit={(value) => onChange(setString(metadata, field.key, value))}
						/>
					))}

					{extraStrings.map((key) => (
						<StringField
							key={key}
							label={key}
							placeholder=""
							value={readStr(metadata[key])}
							onCommit={(value) => onChange(setString(metadata, key, value))}
						/>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
}

function omitKey(metadata: Metadata, key: string): Metadata {
	const next = { ...metadata };
	delete next[key];
	return next;
}
