import { useNavigate } from "@tanstack/react-router";
import { Plus, Terminal, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Text } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSkillsQuery } from "@/hooks/use-skills";
import { isTauri } from "@/lib/tauri";
import { closeProjectTerminal, closeTaskTerminal } from "@/lib/terminal";
import { useIsProjectTerminalOpen, useIsTaskWindowOpen } from "@/stores/terminal-status";
import type { TaskSkill } from "@/types/skills";
import type { TaskFull } from "@/types/tasks";
import { copyToClipboard } from "./agent-runner";
import { buildPromptWithCustomInstructions } from "./build-prompt";
import { SkillCard } from "./skill-card";
import { SkillInstructionsEditor } from "./skill-instructions-editor";

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
	const navigate = useNavigate();
	const skillsQuery = useSkillsQuery();
	const [userInput, setUserInput] = useState("");
	const [editingSkillId, setEditingSkillId] = useState<string | null>(null);

	const isProjectTerminalOpen = useIsProjectTerminalOpen(task.projectId);
	const isTaskWindowOpen = useIsTaskWindowOpen(task.id);
	const builtinSkills = skillsQuery.taskSkills.filter((skill) => skill.source === "builtin");
	const customSkills = skillsQuery.taskSkills.filter((skill) => skill.source === "custom");

	function getSkillById(id: string): TaskSkill | null {
		return skillsQuery.taskSkills.find((skill) => skill.id === id) ?? null;
	}

	function buildCurrentPrompt(skillId: string): string | null {
		const skill = getSkillById(skillId);
		if (!skill) return null;

		return buildPromptWithCustomInstructions({
			userInput,
			skill,
			task,
			selectedSubtaskIds,
		});
	}

	async function handleCopyPrompt(skillId: string) {
		const skill = getSkillById(skillId);
		if (!skill) return;

		if (skill.requiresSubtaskSelection) {
			if (!selectingSubtasks) {
				onStartSubtaskSelection();
				return;
			}

			if (selectedSubtaskIds.length === 0) {
				toast.warning("Selecione pelo menos uma subtask para copiar o prompt");
				return;
			}
		}

		const prompt = buildCurrentPrompt(skillId);
		if (!prompt) {
			toast.error("Erro ao gerar prompt");
			return;
		}

		const success = await copyToClipboard(prompt);
		if (success) {
			toast.success("Prompt copiado para a area de transferencia");

			if (selectingSubtasks) {
				onCancelSubtaskSelection();
			}
		} else {
			toast.error("Erro ao copiar prompt");
		}
	}

	function handleEditInstructions(skillId: string) {
		setEditingSkillId(skillId);
	}

	async function onCloseProjectSession() {
		if (!task.projectId) return;
		await closeProjectTerminal(task.projectId);
	}

	async function onCloseTaskWindow() {
		if (!task.projectId) return;
		await closeTaskTerminal(task.projectId, { id: task.id, title: task.title });
	}

	return (
		<section className="space-y-4 p-2 pr-4 flex h-full flex-col min-h-0">
			{isTauri() && isProjectTerminalOpen && (
				<div className="flex items-center justify-between p-2 border border-green-500/30 bg-green-500/10 rounded">
					<div className="flex items-center gap-2">
						<Terminal className="h-4 w-4 text-green-500" />
						<Text size="xs" className="text-green-500">
							Terminal ativo {isTaskWindowOpen && "(tab aberta)"}
						</Text>
					</div>
					<div className="flex items-center gap-1">
						{isTaskWindowOpen && (
							<Button
								variant="ghost"
								size="sm"
								onClick={onCloseTaskWindow}
								className="h-6 text-xs px-2"
							>
								Fechar tab
							</Button>
						)}
						<Button
							variant="ghost"
							size="sm"
							onClick={onCloseProjectSession}
							className="h-6 text-xs px-2 text-destructive hover:text-destructive"
						>
							Encerrar terminal
						</Button>
					</div>
				</div>
			)}

			<div className="space-y-2">
				<Text size="xs" tone="muted" className="uppercase tracking-wide">
					Painel de controle
				</Text>
				<Textarea
					value={userInput}
					onChange={(e) => setUserInput(e.target.value)}
					placeholder="Descreva instrucoes adicionais, contexto ou ajustes que o agente deve considerar ao executar a skill..."
					disabled={disabled}
					className="min-h-35 resize-none bg-background text-sm"
					rows={6}
				/>
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

			<div className="flex flex-col gap-2 flex-1 min-h-0">
				{skillsQuery.isLoading && (
					<Text size="sm" tone="muted">
						Carregando skills...
					</Text>
				)}

				{!skillsQuery.isLoading && (
					<div className="flex flex-col gap-4 flex-1 min-h-0">
						<section className="space-y-2">
							<Text size="xs" tone="muted" className="uppercase tracking-wide">
								Skills nativas
							</Text>
							<div className="grid grid-cols-1 gap-2">
								{builtinSkills.length === 0 && (
									<Text size="sm" tone="muted">
										Nenhuma skill nativa encontrada
									</Text>
								)}
								{builtinSkills.map((skill) => (
									<SkillCard
										key={skill.id}
										skill={skill}
										variant="task"
										isConfirmMode={selectingSubtasks && skill.requiresSubtaskSelection}
										disabled={disabled}
										onCopyPrompt={handleCopyPrompt}
										onEditInstructions={handleEditInstructions}
									/>
								))}
							</div>
						</section>

						<section className="flex flex-col gap-2 flex-1 min-h-0">
							<Text size="xs" tone="muted" className="uppercase tracking-wide">
								Skills custom
							</Text>
							{customSkills.length === 0 && (
								<Text size="sm" tone="muted">
									Nenhuma skill custom encontrada
								</Text>
							)}
							{customSkills.length > 0 && (
								<div className="flex-1 min-h-0 overflow-y-auto pr-1">
									<div className="grid grid-cols-1 gap-2">
										{customSkills.map((skill) => (
											<SkillCard
												key={skill.id}
												skill={skill}
												variant="task"
												isConfirmMode={selectingSubtasks && skill.requiresSubtaskSelection}
												disabled={disabled}
												onCopyPrompt={handleCopyPrompt}
												onEditInstructions={handleEditInstructions}
											/>
										))}
									</div>
								</div>
							)}

							<button
								type="button"
								className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground transition-colors"
								onClick={() => navigate({ to: "/skills" })}
							>
								<Plus size={16} />
								<span className="text-sm">Criar nova skill</span>
							</button>
						</section>
					</div>
				)}
			</div>

			<SkillInstructionsEditor
				skill={editingSkillId ? getSkillById(editingSkillId) : null}
				onClose={() => setEditingSkillId(null)}
			/>
		</section>
	);
}
