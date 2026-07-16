import { Info } from "lucide-react";
import { useEffect, useState } from "react";

import { Text } from "@/components/typography";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import {
	SKILL_BOOLEAN_FIELDS,
	type SkillBooleanField,
	SKILL_KNOWN_METADATA_KEYS,
	SKILL_STRING_FIELDS,
} from "@/constants/skills";

type Metadata = Record<string, unknown>;

// Parser solto (parseFrontmatterLoose) devolve string quando o YAML estrito falha, então um
// booleano pode chegar como "true"/"false". Normaliza ambos; ausência cai no default do campo.
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

// Toggle no default limpa a chave (mantém o arquivo enxuto); valor divergente é gravado explícito.
function setBool(metadata: Metadata, field: SkillBooleanField, value: boolean): Metadata {
	const next = { ...metadata };
	if (value === field.default) delete next[field.key];
	else next[field.key] = value;
	return next;
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
		.filter((key) => !SKILL_KNOWN_METADATA_KEYS.has(key))
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

// Corpo do editor de metadados do frontmatter: switches dos booleanos (condicionais de invocação) e
// campos de texto com mini-guia pro resto. Modelo e esforço ficam no controle dedicado, fora daqui.
// Cada mudança grava direto no arquivo da variante ativa via `onChange`. O container (popover) é do
// cabeçalho, que o abre pelo menu de ações.
export function SkillMetadataFields({
	metadata,
	onChange,
}: {
	metadata: Metadata;
	onChange: (next: Metadata) => void;
}) {
	const extraBools = extraKeys(metadata, "bool");
	const extraStrings = extraKeys(metadata, "string");

	return (
		<div className="flex flex-col gap-3">
			<Text size="xs" tone="muted" className="font-medium uppercase tracking-wide">
				Invocação
			</Text>
			{SKILL_BOOLEAN_FIELDS.map((field) => (
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
						onCheckedChange={(value) => onChange(setBool(metadata, field, value))}
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

			{SKILL_STRING_FIELDS.map((field) => (
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
	);
}
