import { useMutation } from "@tanstack/react-query";
import { Cpu, Eraser, Gauge, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { orpc } from "@/client";
import {
	PROMPT_ENGINE_EFFORTS,
	PROMPT_ENGINES,
	type PromptEngine,
	type PromptEngineEffort,
} from "@/api/schemas/prompt";
import { GroupLabel, MiniSelect } from "@/components/prompt-bar/controls";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import type { InvokeOption } from "@/constants/invoke";
import { PROMPT_TEMPLATES } from "@/constants/prompt-templates";
import { cn } from "@/lib/utils";
import { usePromptBarStore } from "@/stores/prompt-bar";

const ENGINE_LABELS: Record<PromptEngine, string> = {
	opus: "Opus",
	sonnet: "Sonnet",
	"gpt-5.5": "GPT-5.5",
};

const ENGINE_OPTIONS: InvokeOption[] = PROMPT_ENGINES.map((value) => ({
	value,
	label: ENGINE_LABELS[value],
	hint: value === "gpt-5.5" ? "roda headless via codex" : "roda headless via claude",
}));

const EFFORT_LABELS: Record<PromptEngineEffort, string> = {
	low: "Baixo",
	medium: "Médio",
	high: "Alto",
	xhigh: "Extra",
};

const EFFORT_OPTIONS: InvokeOption[] = PROMPT_ENGINE_EFFORTS.map((value) => ({
	value,
	label: EFFORT_LABELS[value],
	hint: `esforço ${value}`,
}));

// Painel de anexos: templates pré-moldados (Goal/Contexto/...) cujos campos preenchidos entram no
// corpo do prompt antes do texto livre — tanto no "Copiar prompt" quanto na invocação. Escolher um
// template revela os campos dele; clicar de novo desativa. O rascunho de cada template persiste no
// store, então alternar entre eles não perde o que já foi digitado. À direita, o autofill: motor e
// esforço em selects padrão + o botão que preenche a estrutura a partir do texto livre.
export function AttachmentsPanel({ taskId }: { taskId?: string }) {
	const structureTemplate = usePromptBarStore((s) => s.structureTemplate);
	const structureValues = usePromptBarStore((s) => s.structureValues);
	const autofillPending = usePromptBarStore((s) => s.autofillPending);
	const setStructureTemplate = usePromptBarStore((s) => s.setStructureTemplate);
	const setStructureField = usePromptBarStore((s) => s.setStructureField);
	const clearStructureFields = usePromptBarStore((s) => s.clearStructureFields);

	const active = PROMPT_TEMPLATES.find((template) => template.slug === structureTemplate);
	const activeValues = active ? (structureValues[active.slug] ?? {}) : {};
	const hasValues = Object.values(activeValues).some((value) => value.trim());

	return (
		<div className="mt-2 flex flex-col gap-2 border-t border-border pt-2">
			<div className="flex flex-wrap items-center gap-2">
				<GroupLabel>Estrutura</GroupLabel>
				{PROMPT_TEMPLATES.map((template) => (
					<Tooltip key={template.slug} label={template.hint}>
						<button
							type="button"
							aria-pressed={template.slug === structureTemplate}
							onClick={() =>
								setStructureTemplate(template.slug === structureTemplate ? null : template.slug)
							}
							className={cn(
								"flex h-7 shrink-0 cursor-pointer select-none items-center border px-2 text-xs transition-colors",
								"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
								template.slug === structureTemplate
									? "border-primary/40 bg-primary/10 text-foreground"
									: "border-border bg-card text-muted-foreground hover:border-muted-foreground hover:text-foreground",
							)}
						>
							{template.label}
						</button>
					</Tooltip>
				))}

				<div className="ml-auto flex items-center gap-1.5">
					{active && (
						<Tooltip label="Limpar campos do template">
							<button
								type="button"
								aria-label="Limpar campos do template"
								disabled={!hasValues}
								onClick={clearStructureFields}
								className="flex size-6 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-40"
							>
								<Eraser className="size-3.5" />
							</button>
						</Tooltip>
					)}
					<AutofillControls taskId={taskId} />
				</div>
			</div>

			{active && (
				<div className="flex flex-col gap-1.5">
					{active.fields.map((field) => (
						<label key={field.key} className="flex items-start gap-2">
							<span className="w-24 shrink-0 pt-1.5 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground/60">
								{field.label}
							</span>
							{autofillPending ? (
								<div
									className="h-7 w-full animate-pulse rounded-none border border-input bg-muted/40"
									aria-hidden
								/>
							) : (
								<textarea
									value={activeValues[field.key] ?? ""}
									onChange={(event) => setStructureField(field.key, event.target.value)}
									placeholder={field.placeholder}
									rows={1}
									className={cn(
										"max-h-32 w-full resize-none rounded-none border border-input bg-transparent px-2 py-1 text-sm shadow-xs transition-colors field-sizing-content",
										"placeholder:text-muted-foreground/20",
										"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-ring",
									)}
								/>
							)}
						</label>
					))}
				</div>
			)}
		</div>
	);
}

// Autofill: preenche a estrutura a partir do texto livre via `prompt.autofill`. Motor e esforço são
// selects padrão persistidos no store; clique simples faz o merge suave (só campos vazios), Alt-clique
// repreenche tudo. As invocações sugeridas viram a seleção e abrem o painel de invocação. O pending
// viaja pro store pra os campos mostrarem skeletons.
function AutofillControls({ taskId }: { taskId?: string }) {
	const text = usePromptBarStore((s) => s.text);
	const engine = usePromptBarStore((s) => s.autofillEngine);
	const effort = usePromptBarStore((s) => s.autofillEffort);
	const setAutofillEngine = usePromptBarStore((s) => s.setAutofillEngine);
	const setAutofillEffort = usePromptBarStore((s) => s.setAutofillEffort);
	const applyStructureAutofill = usePromptBarStore((s) => s.applyStructureAutofill);
	const setSelection = usePromptBarStore((s) => s.setSelection);
	const setInvokeOpen = usePromptBarStore((s) => s.setInvokeOpen);
	const setAutofillPending = usePromptBarStore((s) => s.setAutofillPending);

	const hasText = text.trim().length > 0;

	const autofill = useMutation(
		orpc.prompt.autofill.mutationOptions({
			onMutate: () => setAutofillPending(true),
			onSettled: () => setAutofillPending(false),
			onError: (error) => toast.error(error.message || "Não foi possível preencher a estrutura"),
		}),
	);

	function run(force: boolean) {
		if (!hasText || autofill.isPending) return;
		autofill.mutate(
			{ text, engine, effort, ...(taskId ? { taskId } : {}) },
			{
				onSuccess: (data) => {
					applyStructureAutofill({ structure: data.structure, fields: data.fields, force });
					const first = data.invocations.at(0);
					if (first) {
						setSelection({ kind: first.kind, slug: first.slug });
						setInvokeOpen(true);
					}
				},
			},
		);
	}

	return (
		<>
			<MiniSelect
				icon={Cpu}
				value={engine}
				onChange={(v) => setAutofillEngine(v as PromptEngine)}
				options={ENGINE_OPTIONS}
			/>
			<MiniSelect
				icon={Gauge}
				value={effort}
				onChange={(v) => setAutofillEffort(v as PromptEngineEffort)}
				options={EFFORT_OPTIONS}
			/>
			<Tooltip
				label={
					autofill.isPending
						? "Preenchendo estrutura..."
						: `Preencher estrutura com ${ENGINE_LABELS[engine]} (Alt: refazer tudo)`
				}
			>
				<Button
					size="sm"
					variant="outline"
					disabled={!hasText || autofill.isPending}
					onClick={(event) => run(event.altKey)}
					aria-label="Preencher estrutura com IA"
				>
					{autofill.isPending ? (
						<Loader2 size={14} className="animate-spin" />
					) : (
						<Sparkles size={14} />
					)}
					Preencher
				</Button>
			</Tooltip>
		</>
	);
}
