import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { parse, stringify } from "yaml";

import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SKILL_SLUG_PATTERN } from "@/constants/skill-slug";
import {
	SKILL_KNOWN_METADATA_KEYS,
	SKILL_METADATA_FIELDS,
	type SkillMetadataField,
} from "@/constants/skills";
import type { SkillDocumentSaveStatus } from "@/routes/_app/skills/-utils/use-skill-document-autosave";

type Metadata = Record<string, unknown>;

const SAVE_STATUS_LABEL: Record<SkillDocumentSaveStatus, string> = {
	idle: "Sem alterações",
	saving: "Salvando…",
	saved: "Salvo",
	error: "Erro ao salvar",
};

function valueType(value: unknown): SkillMetadataField["type"] {
	if (typeof value === "boolean") {
		return "boolean";
	}
	if (typeof value === "number") {
		return "number";
	}
	if (typeof value === "string") {
		return "string";
	}

	return "raw";
}

function RawField({
	field,
	value,
	onCommit,
}: {
	field: SkillMetadataField;
	value: unknown;
	onCommit: (value: unknown) => void;
}) {
	const serialized = value === undefined ? "" : stringify(value).trimEnd();
	const [draft, setDraft] = useState(serialized);
	const [error, setError] = useState<string>();

	useEffect(() => {
		setDraft(serialized);
		setError(undefined);
	}, [serialized]);

	function commit() {
		if (draft === serialized) {
			return;
		}
		try {
			onCommit(parse(draft));
			setError(undefined);
		} catch {
			setError("Valor YAML inválido");
		}
	}

	function changeDraft(next: string) {
		setDraft(next);
		try {
			parse(next);
			setError(undefined);
		} catch {
			setError("Valor YAML inválido");
		}
	}

	return (
		<label className="flex flex-col gap-1.5" data-field-key={field.key}>
			<FieldHeading field={field} />
			<Textarea
				data-slot="raw-input"
				value={draft}
				onChange={(event) => changeDraft(event.target.value)}
				onBlur={commit}
				onKeyDown={(event) => {
					if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
						commit();
					}
				}}
				aria-invalid={!!error}
				className="min-h-16 resize-y font-mono text-xs"
			/>
			{error && (
				<Text size="xs" tone="destructive" data-slot="metadata-error">
					{error}
				</Text>
			)}
		</label>
	);
}

function FieldHeading({ field }: { field: SkillMetadataField }) {
	return (
		<div className="flex items-baseline justify-between gap-3">
			<Text size="sm" className="font-medium">
				{field.label}
			</Text>
			<Text size="xs" tone="muted" className="truncate font-mono">
				{field.key}
			</Text>
		</div>
	);
}

function BooleanField({
	field,
	metadata,
	onChange,
}: {
	field: SkillMetadataField;
	metadata: Metadata;
	onChange: (metadata: Metadata) => void;
}) {
	const explicit = Object.hasOwn(metadata, field.key);
	const checked = explicit ? metadata[field.key] === true : field.default === true;

	function setChecked(next: boolean) {
		onChange({ ...metadata, [field.key]: next });
	}

	return (
		<div
			data-component="skill-metadata-field"
			data-key={field.key}
			data-field-key={field.key}
			data-state={explicit ? "explicit" : "inherited"}
			className="flex items-center gap-2 border border-border px-2 py-1"
		>
			<button
				type="button"
				data-slot="boolean-row"
				onClick={() => setChecked(!checked)}
				aria-pressed={checked}
				className="flex min-w-0 flex-1 items-center gap-3 px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
			>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<Text size="sm" className="font-medium">
							{field.label}
						</Text>
						<Text size="xs" tone="muted">
							{explicit ? "Explícito" : "Herdado"}
						</Text>
					</div>
					<Text size="xs" tone="muted">
						{field.help}
					</Text>
				</div>
			</button>
			<Switch size="sm" checked={checked} onCheckedChange={setChecked} aria-label={field.label} />
			{explicit && (
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label={`Herdar ${field.label}`}
					onClick={() => {
						const next = { ...metadata };
						delete next[field.key];
						onChange(next);
					}}
				>
					<RotateCcw className="size-3.5" />
				</Button>
			)}
		</div>
	);
}

function EnumField({
	field,
	value,
	onCommit,
	onReset,
}: {
	field: SkillMetadataField;
	value: unknown;
	onCommit: (value: string) => void;
	onReset: () => void;
}) {
	const current = typeof value === "string" ? value : "";
	const selected = field.options?.find((option) => option.value === current);
	const items = [
		{ id: "__inherit__", name: "Herdado" },
		...(field.options ?? []).map((option) => ({
			id: option.value,
			name: option.label,
		})),
		...(!selected && current ? [{ id: current, name: `${current} · legado` }] : []),
	];

	return (
		<div className="flex flex-col gap-1.5" data-field-key={field.key}>
			<FieldHeading field={field} />
			<CustomSelect
				items={items}
				value={current || "__inherit__"}
				onValueChange={(next) => {
					if (next === "__inherit__") {
						onReset();
						return;
					}
					onCommit(next);
				}}
				renderItem={(item) => <span>{item.name}</span>}
				renderTrigger={() => (
					<>
						<span className="min-w-0 flex-1 truncate text-left">
							{selected?.label ?? (current ? `${current} · legado` : "Herdado")}
						</span>
						<ChevronDown className="size-4 opacity-50" />
					</>
				)}
				placeholder="Herdado"
				size="sm"
			/>
		</div>
	);
}

function ScalarField({
	field,
	value,
	onCommit,
}: {
	field: SkillMetadataField;
	value: unknown;
	onCommit: (value: string | number) => void;
}) {
	const [draft, setDraft] = useState(value === undefined ? "" : String(value));

	useEffect(() => {
		setDraft(value === undefined ? "" : String(value));
	}, [value]);

	return (
		<label className="flex flex-col gap-1.5" data-field-key={field.key}>
			<FieldHeading field={field} />
			<Input
				type={field.type === "number" ? "number" : "text"}
				value={draft}
				placeholder={field.placeholder}
				onChange={(event) => setDraft(event.target.value)}
				onBlur={() => {
					if (draft === String(value ?? "")) {
						return;
					}
					onCommit(field.type === "number" ? Number(draft) : draft);
				}}
				className="h-8"
			/>
		</label>
	);
}

function MetadataControl({
	field,
	metadata,
	onChange,
}: {
	field: SkillMetadataField;
	metadata: Metadata;
	onChange: (metadata: Metadata) => void;
}) {
	const explicit = Object.hasOwn(metadata, field.key);
	const value = metadata[field.key];
	const compatible =
		value === undefined ||
		(field.type === "boolean" && typeof value === "boolean") ||
		((field.type === "string" || field.type === "enum") && typeof value === "string") ||
		(field.type === "number" && typeof value === "number") ||
		field.type === "raw";
	const effectiveField = compatible ? field : { ...field, type: "raw" as const };

	function setValue(next: unknown) {
		onChange({ ...metadata, [field.key]: next });
	}

	function reset() {
		const next = { ...metadata };
		delete next[field.key];
		onChange(next);
	}

	if (effectiveField.type === "boolean") {
		return <BooleanField field={effectiveField} metadata={metadata} onChange={onChange} />;
	}

	const control =
		effectiveField.type === "enum" ? (
			<EnumField field={effectiveField} value={value} onCommit={setValue} onReset={reset} />
		) : effectiveField.type === "raw" ? (
			<RawField field={effectiveField} value={value} onCommit={setValue} />
		) : (
			<ScalarField field={effectiveField} value={value} onCommit={setValue} />
		);

	return (
		<div
			data-component="skill-metadata-field"
			data-slot="metadata-field"
			data-key={field.key}
			data-state={explicit ? "explicit" : "inherited"}
			data-type={effectiveField.type}
		>
			{control}
			{effectiveField.type !== "enum" && (
				<div className="mt-1 flex justify-end">
					{explicit ? (
						<Button type="button" variant="ghost" size="sm" onClick={reset}>
							<RotateCcw className="size-3.5" />
							Herdar
						</Button>
					) : (
						<Text size="xs" tone="muted">
							Herdado
						</Text>
					)}
				</div>
			)}
		</div>
	);
}

export function SkillDocumentFrontmatter({
	slug,
	description,
	metadata,
	status,
	renaming,
	onSlugCommit,
	onDescriptionChange,
	onDescriptionCommit,
	onMetadataChange,
}: {
	slug: string;
	description: string;
	metadata: Metadata;
	status: SkillDocumentSaveStatus;
	renaming: boolean;
	onSlugCommit: (slug: string) => Promise<void>;
	onDescriptionChange: (description: string) => void;
	onDescriptionCommit: () => void;
	onMetadataChange: (metadata: Metadata) => void;
}) {
	const [open, setOpen] = useState(false);
	const [slugDraft, setSlugDraft] = useState(slug);
	const [slugError, setSlugError] = useState<string>();
	const cancelSlugCommit = useRef(false);
	const preferenceFields = SKILL_METADATA_FIELDS.filter((field) => field.type === "enum");
	const booleanFields = SKILL_METADATA_FIELDS.filter((field) => field.type === "boolean");
	const additionalFields = Object.keys(metadata)
		.filter((key) => !SKILL_KNOWN_METADATA_KEYS.has(key))
		.sort()
		.map(
			(key) =>
				({
					key,
					label: key,
					help: "Chave preservada do frontmatter.",
					type: valueType(metadata[key]),
				}) satisfies SkillMetadataField,
		);

	useEffect(() => {
		setSlugDraft(slug);
		setSlugError(undefined);
	}, [slug]);

	async function commitSlug() {
		const next = slugDraft.trim();
		if (next === slug) {
			setSlugDraft(slug);
			setSlugError(undefined);
			return;
		}
		if (!SKILL_SLUG_PATTERN.test(next)) {
			setSlugError("Use apenas letras minúsculas, números e hífens");
			return;
		}

		try {
			await onSlugCommit(next);
			setSlugError(undefined);
		} catch (err) {
			setSlugDraft(slug);
			setSlugError(err instanceof Error ? err.message : "Não foi possível renomear a skill");
		}
	}

	return (
		<section
			data-component="skill-document-frontmatter"
			className="grid gap-4 border-b border-border pb-5"
		>
			<button
				type="button"
				data-slot="frontmatter-toggle"
				onClick={() => setOpen((current) => !current)}
				aria-expanded={open}
				className="flex w-full items-center gap-2 py-2 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
			>
				{open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
				<Title as="span" size="sm" className="flex-1">
					Frontmatter
				</Title>
				<Text
					as="span"
					size="xs"
					tone={status === "error" ? "destructive" : status === "saved" ? "success" : "muted"}
					data-slot="save-status"
					data-state={status}
					aria-live="polite"
				>
					{SAVE_STATUS_LABEL[status]}
				</Text>
			</button>

			{open && (
				<div className="grid gap-3">
					<div className="grid gap-3 sm:grid-cols-2">
						{preferenceFields.map((field) => (
							<MetadataControl
								key={field.key}
								field={field}
								metadata={metadata}
								onChange={onMetadataChange}
							/>
						))}
					</div>
					<div className="grid gap-2 lg:grid-cols-2">
						{booleanFields.map((field) => (
							<MetadataControl
								key={field.key}
								field={field}
								metadata={metadata}
								onChange={onMetadataChange}
							/>
						))}
					</div>
					{additionalFields.length > 0 && (
						<div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
							{additionalFields.map((field) => (
								<MetadataControl
									key={field.key}
									field={field}
									metadata={metadata}
									onChange={onMetadataChange}
								/>
							))}
						</div>
					)}
				</div>
			)}

			<label className="grid gap-1.5">
				<Text size="xs" tone="muted" className="font-medium uppercase tracking-wide">
					Título
				</Text>
				<Input
					data-slot="slug-input"
					value={slugDraft}
					disabled={renaming}
					onChange={(event) => {
						cancelSlugCommit.current = false;
						setSlugDraft(event.target.value);
						setSlugError(undefined);
					}}
					onBlur={() => {
						if (cancelSlugCommit.current) {
							cancelSlugCommit.current = false;
							return;
						}
						void commitSlug();
					}}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							event.currentTarget.blur();
						}
						if (event.key === "Escape") {
							event.preventDefault();
							event.stopPropagation();
							cancelSlugCommit.current = true;
							setSlugDraft(slug);
							setSlugError(undefined);
							event.currentTarget.blur();
						}
					}}
					aria-invalid={!!slugError}
					className="h-auto border-x-0 border-t-0 bg-transparent px-0 py-1 font-mono text-2xl font-semibold tracking-tight shadow-none"
				/>
				{slugError && (
					<Text size="xs" tone="destructive" data-slot="slug-error">
						{slugError}
					</Text>
				)}
			</label>

			<label className="grid gap-1.5">
				<Text size="sm" className="font-medium">
					Descrição
				</Text>
				<Textarea
					data-slot="description-input"
					value={description}
					onChange={(event) => onDescriptionChange(event.target.value)}
					onBlur={onDescriptionCommit}
					rows={4}
					className="min-h-24 resize-y"
				/>
			</label>
		</section>
	);
}
