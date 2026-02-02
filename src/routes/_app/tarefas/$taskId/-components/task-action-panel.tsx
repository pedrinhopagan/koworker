import { ArrowBigRight, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import type { Agent } from "@/components/agents/AgentSelect";
import { AgentSelect } from "@/components/agents/AgentSelect";
import type { Model } from "@/components/agents/ModelSelect";
import { ModelSelect } from "@/components/agents/ModelSelect";
import { Text } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { TaskFull } from "@/types/tasks";

import {
	copyToClipboard,
	getStoredAgent,
	getStoredModel,
	runSkill,
	setStoredAgent,
	setStoredModel,
} from "./agent-runner";
import { buildPromptWithCustomInstructions, getCustomInstructions } from "./build-prompt";
import { SkillCard } from "./skill-card";
import { SkillInstructionsEditor } from "./skill-instructions-editor";
import { getSkillById, SKILL_IDS, SKILLS, type SkillId } from "./skill-registry";

type TaskActionPanelProps = {
	task: NonNullable<TaskFull>;
	selectingSubtasks: boolean;
	selectedSubtaskIds: string[];
	onStartSubtaskSelection: () => void;
	onCancelSubtaskSelection: () => void;
	disabled?: boolean;
};

export function TaskActionPanel({
	task,
	selectingSubtasks,
	selectedSubtaskIds,
	onStartSubtaskSelection,
	onCancelSubtaskSelection,
	disabled,
}: TaskActionPanelProps) {
	const [userInput, setUserInput] = useState("");
	const [selectedAgentId, setSelectedAgentId] = useState<string | null>(() => getStoredAgent());
	const [selectedModelId, setSelectedModelId] = useState<string | null>(() => getStoredModel());
	const [executingSkillId, setExecutingSkillId] = useState<SkillId | null>(null);
	const [editingSkillId, setEditingSkillId] = useState<SkillId | null>(null);

	useEffect(() => {
		if (selectedAgentId) {
			setStoredAgent(selectedAgentId);
		}
	}, [selectedAgentId]);

	useEffect(() => {
		if (selectedModelId) {
			setStoredModel(selectedModelId);
		}
	}, [selectedModelId]);

	function handleAgentChange(agentId: string, _agent: Agent) {
		setSelectedAgentId(agentId);
	}

	function handleModelChange(modelId: string, _model: Model) {
		setSelectedModelId(modelId);
	}

	function buildCurrentPrompt(skillId: SkillId): string | null {
		const skill = getSkillById(skillId);
		if (!skill) return null;

		const customInstructions = getCustomInstructions(skillId);
		const skillWithInstructions = customInstructions
			? { ...skill, instructions: customInstructions }
			: skill;

		return buildPromptWithCustomInstructions({
			userInput,
			skill: skillWithInstructions,
			task,
			selectedSubtaskIds,
			agent: selectedAgentId ?? "default",
			model: selectedModelId ?? "default",
		});
	}

	async function handleExecuteSkill(skillId: SkillId) {
		const skill = getSkillById(skillId);
		if (!skill) return;

		if (skill.requiresSubtaskSelection) {
			if (!selectingSubtasks) {
				onStartSubtaskSelection();
				return;
			}

			if (selectedSubtaskIds.length === 0) {
				toast.error("Selecione pelo menos uma subtask para executar");
				return;
			}
		}

		const prompt = buildCurrentPrompt(skillId);
		if (!prompt) {
			toast.error("Erro ao gerar prompt");
			return;
		}

		setExecutingSkillId(skillId);

		try {
			const result = await runSkill({
				skillId,
				prompt,
				agent: selectedAgentId ?? "default",
				model: selectedModelId ?? "default",
				taskId: task.id,
			});

			if (result.status === "success") {
				toast.success(result.message ?? "Skill executada com sucesso");
				setUserInput("");

				if (selectingSubtasks) {
					onCancelSubtaskSelection();
				}
			} else {
				toast.error(result.message ?? "Erro ao executar skill");
			}
		} catch (error) {
			console.error("[TaskActionPanel] Erro:", error);
			toast.error("Erro inesperado ao executar skill");
		} finally {
			setExecutingSkillId(null);
		}
	}

	async function handleCopyPrompt(skillId: SkillId) {
		const skill = getSkillById(skillId);
		if (!skill) return;

		if (skill.requiresSubtaskSelection && selectedSubtaskIds.length === 0) {
			toast.warning("Nenhuma subtask selecionada. O prompt será copiado sem subtasks específicas.");
		}

		const prompt = buildCurrentPrompt(skillId);
		if (!prompt) {
			toast.error("Erro ao gerar prompt");
			return;
		}

		const success = await copyToClipboard(prompt);
		if (success) {
			toast.success("Prompt copiado para a área de transferência");
		} else {
			toast.error("Erro ao copiar prompt");
		}
	}

	function handleEditInstructions(skillId: SkillId) {
		setEditingSkillId(skillId);
	}

	return (
		<section className="space-y-2 p-2">
			<div className="space-y-2">
				<Text size="xs" tone="muted" className="uppercase tracking-wide">
					Configurar Agent
				</Text>
				<div className="grid grid-cols-2 gap-3">
					<AgentSelect
						value={selectedAgentId}
						onValueChange={handleAgentChange}
						placeholder="Agent"
						triggerClassName="w-full"
					/>
					<ModelSelect
						value={selectedModelId}
						onValueChange={handleModelChange}
						placeholder="Model"
						triggerClassName="w-full"
					/>
				</div>
			</div>

			<div className="relative">
				<Textarea
					value={userInput}
					onChange={(e) => setUserInput(e.target.value)}
					placeholder="Descreva uma instrução ou quick fix para o agente..."
					disabled={disabled || executingSkillId !== null}
					className="min-h-[100px] resize-none bg-background"
					rows={4}
				/>

				<Button
					variant="outline"
					size="sm"
					// onClick={handleExecute}
					className="absolute bottom-2 right-2"
				>
					<ArrowBigRight />
				</Button>
			</div>

			{selectingSubtasks && (
				<div className="flex items-center justify-between p-2 border border-accent bg-accent/10">
					<div className="flex items-center gap-2">
						<Badge variant="warning">{selectedSubtaskIds.length} selecionada(s)</Badge>
						<Text size="xs" tone="muted">
							Selecione subtasks na lista ao lado
						</Text>
					</div>
					<Button variant="ghost" size="sm" onClick={onCancelSubtaskSelection} className="h-7">
						<X size={14} />
						Cancelar
					</Button>
				</div>
			)}

			<div className="space-y-2">
				<Text size="xs" tone="muted" className="uppercase tracking-wide">
					Skills Disponíveis
				</Text>

				<div className="grid grid-cols-1 gap-2">
					{SKILLS.map((skill) => (
						<SkillCard
							key={skill.id}
							skill={skill}
							isExecuting={executingSkillId === skill.id}
							isConfirmMode={selectingSubtasks && skill.id === SKILL_IDS.EXECUTE_SUBTASKS}
							disabled={disabled || (executingSkillId !== null && executingSkillId !== skill.id)}
							onExecute={handleExecuteSkill}
							onCopyPrompt={handleCopyPrompt}
							onEditInstructions={handleEditInstructions}
						/>
					))}

					<button
						type="button"
						className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground transition-colors"
						onClick={() => toast.info("Em breve: criar nova skill personalizada")}
					>
						<Plus size={16} />
						<span className="text-sm">Criar nova skill</span>
					</button>
				</div>
			</div>

			<SkillInstructionsEditor skillId={editingSkillId} onClose={() => setEditingSkillId(null)} />
		</section>
	);
}
