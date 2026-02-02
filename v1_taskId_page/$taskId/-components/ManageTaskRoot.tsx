import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type TaskStatus } from "../../../../lib/constants/taskStatus";
import { openCodeService } from "../../../../services/opencode";
import { safeInvoke, safeListen } from "../../../../services/tauri";
import type { QuickfixPayload, TaskExecution, TaskUpdatedPayload } from "../../../../types";
import { useGetTaskFullQuery } from "../-utils";
import { useTaskForm } from "../-utils/useTaskForm";
import { useTerminalActionMutation, useLaunchQuickfixMutation } from "../-utils/useTaskMutations";
import { ManageTaskForm } from "./ManageTaskForm";
import { ManageTaskHeader } from "./ManageTaskHeader";
import { ManageTaskMetadata } from "./ManageTaskMetadata";
import { ManageTaskStatus } from "./ManageTaskStatus";

interface ManageTaskRootProps {
	taskId: string;
}

export function ManageTaskRoot({ taskId }: ManageTaskRootProps) {
	const { task, taskFull, project, projectPath, activeExecution, isLoading, refetch } =
		useGetTaskFullQuery({ taskId });

	const projectColor = project?.color || undefined;

	const {
		form,
		isSaving,
		aiUpdatedRecently,
		conflictWarning,
		dismissConflictWarning,
		saveField,
		saveContextField,
		addBusinessRule,
		removeBusinessRule,
		addAcceptanceCriteria,
		removeAcceptanceCriteria,
		addSubtask,
		toggleSubtask,
		removeSubtask,
		updateSubtask,
		reorderSubtasks,
	} = useTaskForm({ taskFull, projectPath });

	const [isOpenCodeConnected, setIsOpenCodeConnected] = useState(false);
	const [localTechnicalNotes, setLocalTechnicalNotes] = useState("");
	const [localDescription, setLocalDescription] = useState("");
	const isDescriptionFocusedRef = useRef(false);
	const isTechnicalNotesFocusedRef = useRef(false);
	const localDescriptionRef = useRef("");
	const localTechnicalNotesRef = useRef("");
	const [isAdjusting, setIsAdjusting] = useState(false);
	const [adjustingPrompt, setAdjustingPrompt] = useState<string | null>(null);
	const [quickfixInput, setQuickfixInput] = useState("");

	const terminalActionMutation = useTerminalActionMutation();
	const launchQuickfixMutation = useLaunchQuickfixMutation();

	const isExecuting = useMemo(() => {
		if (!activeExecution || activeExecution.status !== "running") return false;
		if (activeExecution.last_heartbeat) {
			const last = new Date(activeExecution.last_heartbeat).getTime();
			if (Date.now() - last > 5 * 60 * 1000) return false;
		}
		return true;
	}, [activeExecution]);

	const isBlocked =
		isExecuting ||
		isAdjusting ||
		terminalActionMutation.isPending ||
		launchQuickfixMutation.isPending;

	const pendingSubtasks = useMemo(
		() =>
			taskFull?.subtasks.filter((s) => s.status === "pending").sort((a, b) => a.order - b.order) ||
			[],
		[taskFull?.subtasks],
	);

	const canExecuteSubtask = taskFull && pendingSubtasks.length > 0;

	useEffect(() => {
		if (taskFull) {
			if (!isTechnicalNotesFocusedRef.current) {
				setLocalTechnicalNotes(taskFull.context.technical_notes || "");
				localTechnicalNotesRef.current = taskFull.context.technical_notes || "";
			}
			if (!isDescriptionFocusedRef.current) {
				setLocalDescription(taskFull.context.description || "");
				localDescriptionRef.current = taskFull.context.description || "";
			}
		}
	}, [taskFull]);

	useEffect(() => {
		let unlistenTask: (() => void) | null = null;
		let unlistenExecution: (() => void) | null = null;
		let unlistenQuickfix: (() => void) | null = null;
		let unsubscribeIdle: (() => void) | null = null;
		let unsubscribeFile: (() => void) | null = null;
		let unsubscribeConnection: (() => void) | null = null;

		async function setup() {
			unlistenTask = await safeListen<TaskUpdatedPayload>("task-updated", (event) => {
				if (event.payload.task_id === taskId && event.payload.source === "ai") {
					refetch();
				}
			});

			unlistenExecution = await safeListen<TaskExecution>("execution-changed", (event) => {
				if (event.payload.task_id === taskId) {
					if (event.payload.status === "completed" || event.payload.status === "error") {
						refetch();
					}
				}
			});

			unlistenQuickfix = await safeListen<QuickfixPayload>("quickfix-changed", (event) => {
				if (event.payload.task_id === taskId) {
					if (event.payload.status === "running") {
						setIsAdjusting(true);
						setAdjustingPrompt(event.payload.prompt || null);
					} else {
						setIsAdjusting(false);
						setAdjustingPrompt(null);
						if (event.payload.status === "completed") {
							refetch();
						}
					}
				}
			});

			unsubscribeIdle = openCodeService.onSessionIdle((_sessionId, directory) => {
				if (projectPath && directory.includes(projectPath.split("/").pop() || "")) {
					refetch();
				}
			});

			unsubscribeFile = openCodeService.onFileChange((filePath) => {
				if (filePath.includes(".workopilot/") || filePath.includes("workopilot.db")) {
					refetch();
				}
			});

			unsubscribeConnection = openCodeService.onConnectionChange((connected) => {
				setIsOpenCodeConnected(connected);
			});

			if (!openCodeService.connected) {
				const success = await openCodeService.init();
				if (success) {
					openCodeService.startListening();
				}
			}
		}

		setup();

		return () => {
			unlistenTask?.();
			unlistenExecution?.();
			unlistenQuickfix?.();
			unsubscribeIdle?.();
			unsubscribeFile?.();
			unsubscribeConnection?.();
		};
	}, [taskId, projectPath, refetch]);

	function hideWindowAfterDelay() {
		setTimeout(() => {
			safeInvoke("hide_window");
		}, 500);
	}

	function handleStructureTask() {
		if (!task?.project_id) return;
		terminalActionMutation.mutate(
			{ action: "structure", projectId: task.project_id, taskId: task.id },
			{ onSuccess: hideWindowAfterDelay },
		);
	}

	function handleExecuteAll() {
		if (!task?.project_id) return;
		terminalActionMutation.mutate(
			{ action: "execute_all", projectId: task.project_id, taskId: task.id },
			{ onSuccess: hideWindowAfterDelay },
		);
	}

	function handleExecuteSubtask(subtaskId: string) {
		if (!task?.project_id) return;
		terminalActionMutation.mutate(
			{ action: "execute_subtask", projectId: task.project_id, taskId: task.id, subtaskId },
			{ onSuccess: hideWindowAfterDelay },
		);
	}

	function handleReviewTask() {
		if (!task?.project_id) return;
		terminalActionMutation.mutate(
			{ action: "review", projectId: task.project_id, taskId: task.id },
			{ onSuccess: hideWindowAfterDelay },
		);
	}

	function handleCommitTask() {
		if (!task?.project_id) return;
		terminalActionMutation.mutate(
			{ action: "commit", projectId: task.project_id, taskId: task.id },
			{ onSuccess: hideWindowAfterDelay },
		);
	}

	function handleFocusTerminal() {
		if (!task?.project_id) return;
		terminalActionMutation.mutate({ action: "focus", projectId: task.project_id, taskId: task.id });
	}

	function handleLaunchQuickfix() {
		if (!quickfixInput.trim()) return;
		launchQuickfixMutation.mutate(
			{ taskId, prompt: quickfixInput.trim() },
			{
				onSuccess: () => setQuickfixInput(""),
			},
		);
	}

	function handleStatusChange(newStatus: TaskStatus) {
		saveField("status", newStatus);
	}

	function handleTitleChange(title: string) {
		form.setValue("title", title);
	}

	function handleTitleBlur() {
		saveField("title", form.getValues("title"));
	}

	function handleCategoryChange(category: string) {
		saveField("category", category as "feature" | "bug" | "refactor" | "test" | "docs");
	}

	function handlePriorityChange(priority: number) {
		saveField("priority", priority);
	}

	const handleDescriptionChange = useCallback((value: string) => {
		setLocalDescription(value);
		localDescriptionRef.current = value;
	}, []);

	const handleDescriptionFocus = useCallback(() => {
		isDescriptionFocusedRef.current = true;
	}, []);

	const handleDescriptionBlur = useCallback(() => {
		isDescriptionFocusedRef.current = false;
		if (localDescriptionRef.current !== (taskFull?.context.description || "")) {
			saveContextField("description", localDescriptionRef.current || null);
		}
	}, [taskFull?.context.description, saveContextField]);

	function handleTechnicalNotesSave() {
		if (localTechnicalNotesRef.current !== (taskFull?.context.technical_notes || "")) {
			saveContextField("technical_notes", localTechnicalNotesRef.current || null);
		}
	}

	useEffect(() => {
		return () => {
			if (localDescriptionRef.current !== (taskFull?.context.description || "")) {
				saveContextField("description", localDescriptionRef.current || null);
			}
			if (localTechnicalNotesRef.current !== (taskFull?.context.technical_notes || "")) {
				saveContextField("technical_notes", localTechnicalNotesRef.current || null);
			}
		};
	}, [taskFull?.context.description, taskFull?.context.technical_notes, saveContextField]);

	if (isLoading) {
		return (
			<div className="flex-1 flex items-center justify-center text-muted-foreground">
				Carregando...
			</div>
		);
	}

	if (!taskFull) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
				<span>Tarefa não encontrada</span>
			</div>
		);
	}

	return (
		<>
			<ManageTaskHeader
				title={form.watch("title")}
				category={form.watch("category")}
				priority={form.watch("priority")}
				isSaving={isSaving}
				aiUpdatedRecently={aiUpdatedRecently}
				isOpenCodeConnected={isOpenCodeConnected}
				projectColor={projectColor}
				onTitleChange={handleTitleChange}
				onTitleBlur={handleTitleBlur}
				onCategoryChange={handleCategoryChange}
				onPriorityChange={handlePriorityChange}
			/>

			<ManageTaskStatus
				taskFull={taskFull}
				conflictWarning={conflictWarning}
				canExecuteSubtask={!!canExecuteSubtask}
				pendingSubtasks={pendingSubtasks}
				lastAction={taskFull.ai_metadata.last_completed_action}
				isLaunchingTerminalAction={terminalActionMutation.isPending}
				onDismissConflictWarning={dismissConflictWarning}
				onStatusChange={handleStatusChange}
				onStructureTask={handleStructureTask}
				onExecuteAll={handleExecuteAll}
				onExecuteSubtask={handleExecuteSubtask}
				onReviewTask={handleReviewTask}
				onCommitTask={handleCommitTask}
				onFocusTerminal={handleFocusTerminal}
			/>

			<ManageTaskForm
				taskId={taskId}
				taskFull={taskFull}
				activeExecution={activeExecution}
				isBlocked={isBlocked}
				isExecuting={isExecuting}
				isAdjusting={isAdjusting}
				adjustingPrompt={adjustingPrompt}
				quickfixInput={quickfixInput}
				isLaunchingQuickfix={launchQuickfixMutation.isPending}
				onQuickfixInputChange={setQuickfixInput}
				onLaunchQuickfix={handleLaunchQuickfix}
				localDescription={localDescription}
				onDescriptionChange={handleDescriptionChange}
				onDescriptionFocus={handleDescriptionFocus}
				onDescriptionBlur={handleDescriptionBlur}
				onTechnicalNotesFocus={() => {
					isTechnicalNotesFocusedRef.current = true;
				}}
				onTechnicalNotesBlur={() => {
					isTechnicalNotesFocusedRef.current = false;
					handleTechnicalNotesSave();
				}}
				onTechnicalNotesChange={(value) => {
					setLocalTechnicalNotes(value);
					localTechnicalNotesRef.current = value;
				}}
				onAddSubtask={addSubtask}
				onToggleSubtask={toggleSubtask}
				onRemoveSubtask={removeSubtask}
				onUpdateSubtask={updateSubtask}
				onReorderSubtasks={reorderSubtasks}
				onAddBusinessRule={addBusinessRule}
				onRemoveBusinessRule={removeBusinessRule}
				onAddAcceptanceCriteria={addAcceptanceCriteria}
				onRemoveAcceptanceCriteria={removeAcceptanceCriteria}
				localTechnicalNotes={localTechnicalNotes}
			/>

			<div
				className="p-4 border-t border-border animate-slide-up-fade"
				style={{ animationDelay: "0.4s" }}
			>
				<ManageTaskMetadata taskFull={taskFull} />
			</div>
		</>
	);
}
