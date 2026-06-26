import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Play, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip } from "@/components/ui/tooltip";
import { SKILL_EFFORT_VALUES, SKILL_MODEL_VALUES } from "@/constants/skills";
import { useSkillsQuery } from "@/hooks/use-skills";
import { LucideIcon } from "@/lib/lucide-icon";
import { recordPromptHistory } from "@/lib/prompt-history";
import { executeInTerminal } from "@/lib/terminal";
import { cn } from "@/lib/utils";
import { usePromptBarStore } from "@/stores/prompt-bar";
import type { TaskSkill } from "@/types/skills";

const triggerBase =
	"flex h-6 w-6 items-center justify-center transition-colors disabled:opacity-40";

// O frontmatter da skill é texto livre: só viram flag os valores que o `claude` aceita. Qualquer
// outra coisa (inherit, ausente, lixo) → omitida, mantendo o comando de shell limpo.
function pickFlag(value: unknown, allowed: readonly string[]): string | undefined {
	return typeof value === "string" && allowed.includes(value) ? value : undefined;
}

// O prompt vai como argumento único de `claude "<texto>"` enviado por `tmux send-keys`, onde uma quebra
// de linha vira Enter e dispara o comando cedo. Achatamos toda quebra (e a indentação ao redor) num
// espaço pra manter o prompt inteiro numa string só.
function flattenPrompt(text: string): string {
	return text.replaceAll(/\s*\n+\s*/g, " ").trim();
}

const INVOKE_MODES = [
	{ id: "with", label: "Com prompt" },
	{ id: "only", label: "Só a skill" },
] as const;

type InvokeMode = (typeof INVOKE_MODES)[number]["id"];

function matchSkill(skill: TaskSkill, term: string): boolean {
	return (
		skill.slug.toLowerCase().includes(term) ||
		skill.label.toLowerCase().includes(term) ||
		skill.description.toLowerCase().includes(term)
	);
}

// Botão-toggle do Grupo 1, espelho do AgentPickerButton: abre um picker buscável; com uma skill ativa,
// clicar de novo desativa. Lista só as skills marcadas como invocação rápida (`quickInvoke`, toggle na
// aparência da skill) — o spawn dispara `/<slug>` puro, então o picker é só pra ações que rodam
// sozinhas. A skill roda no projeto em foco.
export function SkillPickerButton({
	selected,
	onSelect,
	onClear,
	projectName,
}: {
	selected: TaskSkill | null;
	onSelect: (skill: TaskSkill) => void;
	onClear: () => void;
	projectName?: string;
}) {
	const { taskSkills, isLoading } = useSkillsQuery(projectName);
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	if (selected) {
		return (
			<Tooltip label={`Skill ativa: ${selected.label} — clique para desativar`}>
				<button
					type="button"
					aria-label="Desativar skill"
					onClick={onClear}
					className={cn(triggerBase, "text-primary hover:text-primary/80")}
				>
					<Sparkles className="h-3.5 w-3.5" />
				</button>
			</Tooltip>
		);
	}

	const term = query.trim().toLowerCase();
	const matches = taskSkills.filter(
		(skill) => skill.quickInvoke && (!term || matchSkill(skill, term)),
	);

	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) setQuery("");
			}}
		>
			<PopoverTrigger asChild>
				<button
					type="button"
					aria-label="Escolher skill"
					title="Invocar skill com modelo e esforço fixados"
					className={cn(triggerBase, "text-muted-foreground hover:text-foreground")}
				>
					<Sparkles className="h-3.5 w-3.5" />
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				side="top"
				className="w-72 p-0"
				onOpenAutoFocus={(event) => {
					// O FocusScope do Radix puxa o foco pro container; forçamos o input pra busca já valer.
					event.preventDefault();
					inputRef.current?.focus();
				}}
			>
				<div className="border-b border-border p-2">
					<Input
						ref={inputRef}
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Buscar skill..."
						className="h-8"
					/>
				</div>
				<div className="max-h-72 overflow-y-auto p-1">
					{matches.length === 0 ? (
						<div className="px-2 py-1.5 text-xs text-muted-foreground">
							{isLoading ? "Carregando..." : "Nenhuma skill encontrada"}
						</div>
					) : (
						matches.map((skill) => (
							<button
								key={skill.slug}
								type="button"
								onClick={() => {
									onSelect(skill);
									setOpen(false);
								}}
								className="flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors hover:bg-secondary/50"
							>
								<div
									className="flex h-6 w-6 shrink-0 items-center justify-center border bg-muted/30"
									style={{ borderColor: skill.color, color: skill.color }}
								>
									<LucideIcon name={skill.icon} className="size-3.5" />
								</div>
								<div className="min-w-0 flex-1">
									<div className="truncate font-mono text-sm text-foreground">/{skill.slug}</div>
									<div className="truncate text-xs text-muted-foreground">{skill.description}</div>
								</div>
							</button>
						))
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}

// Botão de ação do Grupo 3: dispara a skill ativa numa nova aba tmux do projeto, como `/<slug> <texto>`,
// com `--model`/`--effort` lidos do frontmatter. Ao contrário do agent, não precisa de alvo `/kw`.
export function SkillInvokeButton({
	skill,
	projectName,
	onInvoked,
}: {
	skill: TaskSkill;
	projectName?: string;
	onInvoked: () => void;
}) {
	const projectsQuery = useQuery(orpc.projects.list.queryOptions());
	const [mode, setMode] = useState<InvokeMode>("with");

	function handleInvoke() {
		const project = projectsQuery.data?.find((p) => p.name === projectName);
		if (!project) {
			toast.error("Projeto não encontrado");
			return;
		}

		const text = mode === "with" ? flattenPrompt(usePromptBarStore.getState().text) : "";
		const prompt = text ? `/${skill.slug} ${text}` : `/${skill.slug}`;

		const model = pickFlag(skill.metadata.model, SKILL_MODEL_VALUES);
		const effort = pickFlag(skill.metadata.effort, SKILL_EFFORT_VALUES);

		void executeInTerminal(
			{ id: project.id, name: project.name, mainRoute: project.mainRoute },
			{ id: `skill_${skill.slug}`, title: skill.label },
			prompt,
			{
				...(model ? { model } : {}),
				...(effort ? { effort } : {}),
				forceNew: true,
			},
		);

		recordPromptHistory({
			kind: "skill",
			text,
			prompt,
			skillSlug: skill.slug,
			projectId: project.id,
			projectName: project.name,
			...(model ? { model } : {}),
			...(effort ? { effort } : {}),
		});

		onInvoked();
	}

	return (
		<div className="flex shrink-0 items-center gap-1">
			<CustomSelect
				items={INVOKE_MODES.map((m) => ({ id: m.id, label: m.label }))}
				value={mode}
				onValueChange={(value) => setMode(value as InvokeMode)}
				size="sm"
				fitContent
				side="top"
				align="end"
				renderItem={(item) => <span className="text-xs">{item.label}</span>}
				renderTrigger={() => (
					<>
						<span className="text-xs">{INVOKE_MODES.find((m) => m.id === mode)?.label}</span>
						<ChevronDown className="size-3.5 opacity-50" />
					</>
				)}
			/>
			<Tooltip
				label={`Invocar /${skill.slug} numa nova aba do terminal`}
				triggerClassName="inline-flex shrink-0"
			>
				<Button size="sm" variant="secondary" disabled={!projectName} onClick={handleInvoke}>
					<Play size={14} />
					Invocar skill
				</Button>
			</Tooltip>
		</div>
	);
}
