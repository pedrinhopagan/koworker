import { type FormEvent, useEffect, useState } from "react";

import type { RouterOutputs } from "@/client";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PROMPT_HISTORY_KIND_LABEL, type PromptHistoryKind } from "./prompt-history-kind";

type PromptHistoryItem = RouterOutputs["promptHistory"]["list"]["items"][number];

export type PromptHistoryFormValues = {
	kind: PromptHistoryKind;
	text: string;
	prompt: string;
	target: string;
	projectName: string;
	routePath: string;
	agentSlug: string;
	skillSlug: string;
	model: string;
	effort: string;
};

type PromptHistoryFormDialogProps = {
	open: boolean;
	item: PromptHistoryItem | null;
	loading: boolean;
	onClose: () => void;
	onSubmit: (values: PromptHistoryFormValues) => void;
};

const emptyValues: PromptHistoryFormValues = {
	kind: "copy",
	text: "",
	prompt: "",
	target: "",
	projectName: "",
	routePath: "",
	agentSlug: "",
	skillSlug: "",
	model: "",
	effort: "",
};

function valuesFromItem(item: PromptHistoryItem | null): PromptHistoryFormValues {
	if (!item) return emptyValues;

	return {
		kind: item.kind,
		text: item.text,
		prompt: item.prompt,
		target: item.target ?? "",
		projectName: item.projectName ?? "",
		routePath: item.routePath ?? "",
		agentSlug: item.agentSlug ?? "",
		skillSlug: item.skillSlug ?? "",
		model: item.model ?? "",
		effort: item.effort ?? "",
	};
}

export function PromptHistoryFormDialog({
	open,
	item,
	loading,
	onClose,
	onSubmit,
}: PromptHistoryFormDialogProps) {
	const [values, setValues] = useState<PromptHistoryFormValues>(emptyValues);
	const editing = !!item;
	const canSubmit = values.prompt.trim().length > 0 && !loading;

	useEffect(() => {
		if (open) {
			setValues(valuesFromItem(item));
		}
	}, [open, item]);

	function update<K extends keyof PromptHistoryFormValues>(
		key: K,
		value: PromptHistoryFormValues[K],
	) {
		setValues((prev) => ({ ...prev, [key]: value }));
	}

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!canSubmit) return;
		onSubmit(values);
	}

	return (
		<Dialog
			open={open}
			onClose={onClose}
			title={editing ? "Editar prompt" : "Novo prompt"}
			description={editing ? "Atualize o registro selecionado" : "Adicione um prompt ao histórico"}
			className="max-w-2xl"
			footer={
				<>
					<Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
						Cancelar
					</Button>
					<Button type="submit" form="prompt-history-form" disabled={!canSubmit}>
						{loading ? "Salvando..." : "Salvar"}
					</Button>
				</>
			}
		>
			<form id="prompt-history-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
				<div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
					<div className="flex flex-col gap-2">
						<Label htmlFor="prompt-kind">Tipo</Label>
						<Select
							value={values.kind}
							onValueChange={(value) => update("kind", value as PromptHistoryKind)}
						>
							<SelectTrigger id="prompt-kind" className="h-11 text-base md:h-9 md:text-sm">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{Object.entries(PROMPT_HISTORY_KIND_LABEL).map(([value, label]) => (
									<SelectItem key={value} value={value}>
										{label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="prompt-target">Alvo</Label>
						<Input
							id="prompt-target"
							value={values.target}
							onChange={(event) => update("target", event.target.value)}
							placeholder=".koworker/id/index.md"
							className="h-11 text-base md:h-9 md:text-sm"
						/>
					</div>
				</div>

				<div className="flex flex-col gap-2">
					<Label htmlFor="prompt-text">Texto original</Label>
					<Input
						id="prompt-text"
						value={values.text}
						onChange={(event) => update("text", event.target.value)}
						placeholder="Instrução digitada antes de montar o prompt final"
						className="h-11 text-base md:h-9 md:text-sm"
					/>
				</div>

				<div className="flex flex-col gap-2">
					<div className="flex items-center justify-between gap-3">
						<Label htmlFor="prompt-final">Prompt final</Label>
						<Text size="xs" tone={values.prompt.trim() ? "muted" : "destructive"}>
							obrigatório
						</Text>
					</div>
					<Textarea
						id="prompt-final"
						value={values.prompt}
						onChange={(event) => update("prompt", event.target.value)}
						placeholder="Prompt que será copiado novamente"
						className="min-h-48 text-base md:text-sm"
					/>
				</div>

				<div className="grid gap-4 sm:grid-cols-2">
					<Field
						id="prompt-project"
						label="Projeto"
						value={values.projectName}
						onChange={(value) => update("projectName", value)}
					/>
					<Field
						id="prompt-route"
						label="Rota"
						value={values.routePath}
						onChange={(value) => update("routePath", value)}
					/>
					<Field
						id="prompt-agent"
						label="Agent"
						value={values.agentSlug}
						onChange={(value) => update("agentSlug", value)}
					/>
					<Field
						id="prompt-skill"
						label="Skill"
						value={values.skillSlug}
						onChange={(value) => update("skillSlug", value)}
					/>
					<Field
						id="prompt-model"
						label="Modelo"
						value={values.model}
						onChange={(value) => update("model", value)}
					/>
					<Field
						id="prompt-effort"
						label="Esforço"
						value={values.effort}
						onChange={(value) => update("effort", value)}
					/>
				</div>
			</form>
		</Dialog>
	);
}

type FieldProps = {
	id: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
};

function Field({ id, label, value, onChange }: FieldProps) {
	return (
		<div className="flex min-w-0 flex-col gap-2">
			<Label htmlFor={id}>{label}</Label>
			<Input
				id={id}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className="h-11 text-base md:h-9 md:text-sm"
			/>
		</div>
	);
}
