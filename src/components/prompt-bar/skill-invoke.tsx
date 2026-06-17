import { useQuery } from "@tanstack/react-query";
import { Play, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { SKILL_EFFORT_VALUES, SKILL_MODEL_VALUES } from "@/constants/skills";
import { useSkillsQuery } from "@/hooks/use-skills";
import { LucideIcon } from "@/lib/lucide-icon";
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

// Botão-toggle do Grupo 1, espelho do AgentPickerButton: abre o menu de skills; com uma skill ativa,
// clicar de novo desativa. A skill roda no projeto em foco — não depende de rota que anexa `/kw`.
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

	return (
		<DropdownMenu>
			<Tooltip label="Invocar skill com modelo e esforço fixados">
				<DropdownMenuTrigger
					aria-label="Escolher skill"
					className={cn(triggerBase, "text-muted-foreground hover:text-foreground")}
				>
					<Sparkles className="h-3.5 w-3.5" />
				</DropdownMenuTrigger>
			</Tooltip>
			<DropdownMenuContent align="start" side="top" className="max-h-80 w-72 overflow-y-auto">
				<DropdownMenuLabel>Invocar skill</DropdownMenuLabel>
				{taskSkills.length === 0 ? (
					<div className="px-2 py-1.5 text-xs text-muted-foreground">
						{isLoading ? "Carregando..." : "Nenhuma skill cadastrada"}
					</div>
				) : (
					taskSkills.map((skill) => (
						<DropdownMenuItem
							key={skill.slug}
							onSelect={() => onSelect(skill)}
							className="flex items-center gap-2"
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
						</DropdownMenuItem>
					))
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// Botão de ação do Grupo 3: dispara a skill ativa numa nova aba tmux do projeto, como `/<slug> <texto>`,
// com `--model`/`--effort` lidos do frontmatter. Ao contrário do agent, não precisa de alvo `/kw`.
export function SkillInvokeButton({
	skill,
	projectName,
}: {
	skill: TaskSkill;
	projectName?: string;
}) {
	const projectsQuery = useQuery(orpc.projects.list.queryOptions());

	function handleInvoke() {
		const project = projectsQuery.data?.find((p) => p.name === projectName);
		if (!project) {
			toast.error("Projeto não encontrado");
			return;
		}

		const text = usePromptBarStore.getState().text.trim();
		const prompt = text ? `/${skill.slug}\n\n${text}` : `/${skill.slug}`;

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
	}

	return (
		<Tooltip
			label={`Invocar /${skill.slug} numa nova aba do terminal`}
			triggerClassName="inline-flex shrink-0"
		>
			<Button size="sm" variant="secondary" disabled={!projectName} onClick={handleInvoke}>
				<Play size={14} />
				Invocar skill
			</Button>
		</Tooltip>
	);
}
