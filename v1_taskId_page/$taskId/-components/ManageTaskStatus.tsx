import { TaskStatusSelect } from "@/components/tasks/TaskStatusSelect";
import { CustomSelect } from "@/components/ui/custom-select";
import { getActionById, getSuggestedActionFromRegistry } from "@/lib/constants/actionRegistry";
import {
	deriveProgressState,
	getTaskProgressStateColor,
	getTaskProgressStateContainerClass,
	getTaskProgressStateHighlight,
	getTaskProgressStateLabel,
	type TaskStatus,
} from "@/lib/constants/taskStatus";
import type { Subtask, TaskFull } from "@/types";
import { AlertTriangle, Copy, FileCheck, Loader2, Monitor, MoreVertical, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ManageTaskStatusProps {
	taskFull: TaskFull;
	conflictWarning: boolean;
	canExecuteSubtask: boolean;
	pendingSubtasks: Subtask[];
	lastAction: string | null;
	isLaunchingTerminalAction: boolean;
	onDismissConflictWarning: () => void;
	onStatusChange: (status: TaskStatus) => void;
	onStructureTask: () => void;
	onExecuteAll: () => void;
	onExecuteSubtask: (subtaskId: string) => void;
	onReviewTask: () => void;
	onCommitTask: () => void;
	onFocusTerminal: () => void;
}

export function ManageTaskStatus({
	taskFull,
	conflictWarning,
	canExecuteSubtask,
	pendingSubtasks,
	lastAction,
	isLaunchingTerminalAction,
	onDismissConflictWarning,
	onStatusChange,
	onStructureTask,
	onExecuteAll,
	onExecuteSubtask,
	onReviewTask,
	onCommitTask,
	onFocusTerminal,
}: ManageTaskStatusProps) {
	const progressState = deriveProgressState(taskFull);
	const progressColor = getTaskProgressStateColor(taskFull);
	const progressLabel = getTaskProgressStateLabel(taskFull);
	const progressHighlight = getTaskProgressStateHighlight(taskFull);
	const progressContainerClass = getTaskProgressStateContainerClass(taskFull);
	const suggestedAction = getSuggestedActionFromRegistry(taskFull);

	const actionCallbacks: Record<string, () => void> = {
		structure: onStructureTask,
		execute_all: onExecuteAll,
		review: onReviewTask,
		commit: onCommitTask,
		focus_terminal: onFocusTerminal,
	};

	const executeSubtaskAction = getActionById("execute_subtask");

	const DISPLAY_ORDER: Array<{ type: "button"; id: string } | { type: "subtask_select" }> = [
		{ type: "button", id: "structure" },
		{ type: "button", id: "execute_all" },
		{ type: "subtask_select" },
		{ type: "button", id: "review" },
		{ type: "button", id: "commit" },
	];

	return (
		<>
			{conflictWarning && (
				<div className="px-4 py-2 bg-border border-b border-muted text-foreground text-sm flex items-center gap-2">
					<AlertTriangle size={16} className="text-accent" />
					<span>
						A IA fez alteracoes nesta task. Suas edicoes podem sobrescrever as mudancas da IA.
					</span>
					<button
						type="button"
						onClick={onDismissConflictWarning}
						className="ml-auto text-muted-foreground hover:text-foreground"
					>
						<X size={14} />
					</button>
				</div>
			)}

			<div
				className={`border-b border-border animate-fade-in ${progressContainerClass} ${
					progressHighlight === "pulse" ? "animate-pulse" : ""
				}`}
			>
				<div className="px-4 py-3 flex items-center gap-4 border-b border-secondary transition-all duration-200">
					<TaskStatusSelect value={taskFull.status as TaskStatus} onChange={onStatusChange} />

					<span
						className="px-2 py-1 text-xs font-medium rounded"
						style={{
							backgroundColor: `${progressColor}20`,
							color: progressColor,
						}}
					>
						{progressLabel}
					</span>

					<button
						type="button"
						onClick={onFocusTerminal}
						disabled={isLaunchingTerminalAction}
						className="px-2 py-1 text-xs font-medium rounded border border-border bg-card text-foreground hover:bg-secondary hover:border-muted transition-all duration-200 flex items-center gap-1.5"
						title="Focar no terminal da task (cria se não existir)"
					>
						<Monitor size={12} />
						<span>Terminal</span>
					</button>

					{lastAction && (
						<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
							<span className="w-3 h-3">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<title>Icone de IA</title>
									<path d="M12 8V4H8" />
									<rect width="16" height="12" x="4" y="8" rx="2" />
									<path d="M2 14h2" />
									<path d="M20 14h2" />
									<path d="M15 13v2" />
									<path d="M9 13v2" />
								</svg>
							</span>
							<span>
								Última ação: <span className="text-primary">{lastAction}</span>
							</span>
						</div>
					)}

					<div className="ml-auto flex items-center gap-1">
						<span
							className={`w-1.5 h-1.5 rounded-full transition-colors ${
								progressState !== "idle" ? "bg-primary" : "bg-border"
							}`}
							title="Pendente -> Iniciada"
						/>
						<span
							className={`w-4 h-px ${
								[
									"ready-to-start",
									"in-execution",
									"ready-to-review",
									"ready-to-commit",
									"ai-working",
									"done",
								].includes(progressState)
									? "bg-primary"
									: "bg-border"
							}`}
						/>
						<span
							className={`w-1.5 h-1.5 rounded-full transition-colors ${
								[
									"in-execution",
									"ready-to-review",
									"ready-to-commit",
									"ai-working",
									"done",
								].includes(progressState)
									? "bg-primary"
									: "bg-border"
							}`}
							title="Estruturada -> Trabalhando"
						/>
						<span
							className={`w-4 h-px ${
								["ready-to-review", "ready-to-commit", "done"].includes(progressState)
									? "bg-primary"
									: "bg-border"
							}`}
						/>
						<span
							className={`w-1.5 h-1.5 rounded-full transition-colors ${
								["ready-to-commit", "done"].includes(progressState) ? "bg-primary" : "bg-border"
							}`}
							title="Revisada -> Commit"
						/>
						<span className={`w-4 h-px ${progressState === "done" ? "bg-primary" : "bg-border"}`} />
						<span
							className={`w-1.5 h-1.5 rounded-full transition-colors ${
								progressState === "done" ? "bg-primary" : "bg-border"
							}`}
							title="Concluida"
						/>
					</div>
				</div>

				<div
					className="px-4 py-4 flex items-stretch gap-3 animate-slide-up-fade"
					style={{ animationDelay: "0.1s" }}
				>
					{DISPLAY_ORDER.map((slot) => {
						if (slot.type === "subtask_select" && executeSubtaskAction) {
							return (
								<div key="execute_subtask" className="flex-1 relative">
									<CustomSelect
										items={pendingSubtasks}
										onValueChange={(subtaskId) => onExecuteSubtask(subtaskId)}
										label="Selecione uma subtask"
										disabled={isLaunchingTerminalAction || !canExecuteSubtask}
										triggerClassName={`w-full h-full flex flex-row items-center justify-center gap-2 p-4 border transition-all duration-200 ${
											suggestedAction?.id === "execute_subtask"
												? "shadow-lg"
												: "border-border bg-card text-foreground hover:border-muted hover:bg-secondary"
										}`}
										triggerStyle={
											suggestedAction?.id === "execute_subtask"
												? {
														borderColor: executeSubtaskAction.color,
														backgroundColor: `${executeSubtaskAction.color}1a`,
														color: executeSubtaskAction.color,
														boxShadow: `0 10px 15px -3px ${executeSubtaskAction.color}1a, 0 4px 6px -4px ${executeSubtaskAction.color}1a`,
													}
												: undefined
										}
										contentClassName="min-w-[var(--radix-select-trigger-width)]"
										renderTrigger={() => {
											const SubtaskIcon = executeSubtaskAction.icon;
											return (
												<>
													<SubtaskIcon size={20} />
													<span className="text-sm font-medium">{executeSubtaskAction.label}</span>
													{canExecuteSubtask && (
														<span className="text-[10px] opacity-60">
															({pendingSubtasks.length})
														</span>
													)}
												</>
											);
										}}
										renderItem={(subtask) => (
											<SubtaskSelectItem subtask={subtask} taskFull={taskFull} />
										)}
									/>
									{suggestedAction?.id === "execute_subtask" && (
										<span
											className="absolute -top-2 -left-2 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-background z-10"
											style={{ backgroundColor: executeSubtaskAction.color }}
										>
											Sugestão
										</span>
									)}
								</div>
							);
						}

						if (slot.type === "button") {
							const action = getActionById(slot.id);
							if (!action) return null;
							const isSuggested = suggestedAction?.id === action.id;
							const ActionIcon = action.icon;
							return (
								<ActionButton
									key={action.id}
									label={action.label}
									icon={<ActionIcon size={20} />}
									isLoading={isLaunchingTerminalAction}
									isSuggested={isSuggested}
									suggestedHexColor={isSuggested ? action.color : progressColor}
									prompt={action.generatePrompt(taskFull)}
									onClick={actionCallbacks[action.id]}
								/>
							);
						}

						return null;
					})}
				</div>
			</div>
		</>
	);
}

interface ActionButtonProps {
	label: string;
	icon: React.ReactNode;
	isLoading: boolean;
	isSuggested: boolean;
	suggestedHexColor: string;
	prompt: string;
	onClick: () => void;
}

function ActionButton({
	label,
	icon,
	isLoading,
	isSuggested,
	suggestedHexColor,
	prompt,
	onClick,
}: ActionButtonProps) {
	const [showMenu, setShowMenu] = useState(false);
	const [copied, setCopied] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setShowMenu(false);
			}
		}
		if (showMenu) {
			document.addEventListener("mousedown", handleClickOutside);
		}
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [showMenu]);

	async function handleCopyPrompt(e: React.MouseEvent) {
		e.stopPropagation();
		try {
			await navigator.clipboard.writeText(prompt);
			setCopied(true);
			setTimeout(() => {
				setCopied(false);
				setShowMenu(false);
			}, 1000);
		} catch (err) {
			console.error("Failed to copy:", err);
		}
	}

	return (
		<div className="flex-1 relative" ref={menuRef}>
			<button
				type="button"
				onClick={onClick}
				className={`w-full h-full flex flex-row items-center justify-center gap-2 p-4 border transition-all duration-200 ${
					isSuggested
						? "shadow-lg"
						: "border-border bg-card text-foreground hover:border-muted hover:bg-secondary"
				}`}
				style={
					isSuggested
						? {
								borderColor: suggestedHexColor,
								backgroundColor: `${suggestedHexColor}1a`,
								color: suggestedHexColor,
								boxShadow: `0 10px 15px -3px ${suggestedHexColor}1a, 0 4px 6px -4px ${suggestedHexColor}1a`,
							}
						: undefined
				}
			>
				{isLoading ? <Loader2 size={20} className="animate-spin" /> : icon}
				<span className="text-sm font-medium">{label}</span>
			</button>

			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					setShowMenu(!showMenu);
				}}
				className="absolute top-1 right-1 p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
			>
				<MoreVertical size={14} />
			</button>

			{showMenu && (
				<div className="absolute top-8 right-1 bg-card border border-border shadow-lg z-50 min-w-[140px] animate-slide-down">
					<button
						type="button"
						onClick={handleCopyPrompt}
						className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-secondary transition-colors flex items-center gap-2"
					>
						<Copy size={14} />
						{copied ? "Copiado!" : "Copiar prompt"}
					</button>
				</div>
			)}

			{isSuggested && (
				<span
					className="absolute -top-2 -left-2 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-background"
					style={{ backgroundColor: suggestedHexColor }}
				>
					Sugestão
				</span>
			)}
		</div>
	);
}

interface SubtaskSelectItemProps {
	subtask: Subtask;
	taskFull: TaskFull;
}

function SubtaskSelectItem({ subtask, taskFull }: SubtaskSelectItemProps) {
	const [copied, setCopied] = useState(false);
	const executeSubtaskAction = getActionById("execute_subtask");

	async function handleCopyPrompt(e: React.MouseEvent) {
		e.stopPropagation();
		e.preventDefault();
		const prompt = executeSubtaskAction
			? executeSubtaskAction.generatePrompt(taskFull, subtask.id)
			: "";
		try {
			await navigator.clipboard.writeText(prompt);
			setCopied(true);
			setTimeout(() => setCopied(false), 1000);
		} catch (err) {
			console.error("Failed to copy:", err);
		}
	}

	return (
		<div className="flex items-center min-w-0 hover:bg-secondary transition-colors">
			<div className="flex-1 min-w-0 px-3 py-2.5 text-left text-sm text-foreground flex items-center gap-2">
				<span className="w-5 h-5 shrink-0 flex items-center justify-center bg-border text-[10px] text-primary">
					{subtask.order + 1}
				</span>
				<span className="flex-1 min-w-0 truncate">{subtask.title}</span>
			</div>

			<button
				type="button"
				onClick={handleCopyPrompt}
				className="shrink-0 px-2 py-2.5 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
				title="Copiar prompt"
			>
				{copied ? <FileCheck size={14} className="text-primary" /> : <Copy size={14} />}
			</button>
		</div>
	);
}
