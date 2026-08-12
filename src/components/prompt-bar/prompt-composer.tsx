import {
	ChevronRight,
	ChevronsDownUp,
	ChevronsUpDown,
	Copy,
	Bot,
	Crosshair,
	Loader2,
	type LucideIcon as LucideIconType,
} from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AttachmentsPanel } from "@/components/prompt-bar/attachments-panel";
import { ExecutePanel } from "@/components/prompt-bar/execute-panel";
import { Collapse, GroupLabel, MiniSelect, ToggleBox } from "@/components/prompt-bar/controls";
import { InvokePanel } from "@/components/prompt-bar/invoke-panel";
import { PromptField } from "@/components/prompt-bar/prompt-field";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { INVOKE_CLI_OPTIONS, type InvokeCli } from "@/constants/invoke";
import { useRouteDocTarget } from "@/hooks/use-route-doc-target";
import {
	buildKoworkerPrompt,
	buildPromptBody,
	convertSkillCallsForCli,
	copyToClipboard,
} from "@/lib/build-prompt";
import { recordPromptHistory } from "@/lib/prompt-history";
import { focusCliAgent } from "@/lib/terminal";
import { cn } from "@/lib/utils";
import { usePromptBarStore } from "@/stores/prompt-bar";

export function PromptComposer() {
	const cli = usePromptBarStore((s) => s.cli);
	const invokeOpen = usePromptBarStore((s) => s.invokeOpen);
	const executeOpen = usePromptBarStore((s) => s.executeOpen);
	const attachOpen = usePromptBarStore((s) => s.attachOpen);
	const structureOpen = usePromptBarStore((s) => s.structureOpen);
	const interactWithKw = usePromptBarStore((s) => s.interactWithKw);
	const interactWithRoute = usePromptBarStore((s) => s.interactWithRoute);
	const interactWithInput = usePromptBarStore((s) => s.interactWithInput);
	const toggleInvokeOpen = usePromptBarStore((s) => s.toggleInvokeOpen);
	const toggleExecuteOpen = usePromptBarStore((s) => s.toggleExecuteOpen);
	const toggleAttachOpen = usePromptBarStore((s) => s.toggleAttachOpen);
	const toggleStructureOpen = usePromptBarStore((s) => s.toggleStructureOpen);
	const setAllSectionsOpen = usePromptBarStore((s) => s.setAllSectionsOpen);
	const setInteractWithKw = usePromptBarStore((s) => s.setInteractWithKw);
	const setInteractWithRoute = usePromptBarStore((s) => s.setInteractWithRoute);
	const setInteractWithInput = usePromptBarStore((s) => s.setInteractWithInput);
	const setStructureTemplate = usePromptBarStore((s) => s.setStructureTemplate);

	const routeTarget = useRouteDocTarget();
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	const lastSuggestedTaskId = useRef<string | null>(null);
	useEffect(() => {
		const { taskId, categoryStructureSlug } = routeTarget;
		if (!taskId || !categoryStructureSlug) return;
		if (lastSuggestedTaskId.current === taskId) return;
		lastSuggestedTaskId.current = taskId;
		if (usePromptBarStore.getState().structureTemplate === null) {
			setStructureTemplate(categoryStructureSlug);
		}
	}, [routeTarget.taskId, routeTarget.categoryStructureSlug, setStructureTemplate]);

	const appendTarget = interactWithRoute ? routeTarget.path : null;

	const [focusing, setFocusing] = useState(false);
	const cliLabel = INVOKE_CLI_OPTIONS.find((option) => option.value === cli)?.label ?? cli;

	async function handleFocusAgent() {
		setFocusing(true);
		await focusCliAgent({
			cli,
			...(routeTarget.projectId ? { projectId: routeTarget.projectId } : {}),
		});
		setFocusing(false);
	}

	async function handleCopy() {
		const { text, structureTemplate, structureValues, images } = usePromptBarStore.getState();
		const copyText = interactWithInput
			? buildPromptBody({ templateSlug: structureTemplate, values: structureValues, text, images })
			: "";
		const prompt = convertSkillCallsForCli(
			buildKoworkerPrompt({ kw: interactWithKw, target: appendTarget, text: copyText }),
			cli,
		);
		if (!prompt.trim()) {
			toast.info("Nada para copiar");
			return;
		}
		const ok = await copyToClipboard(prompt);
		if (ok) {
			recordPromptHistory({
				kind: "copy",
				text,
				prompt,
				...(appendTarget ? { target: appendTarget } : {}),
				...(routeTarget.projectName ? { projectName: routeTarget.projectName } : {}),
				...(pathname ? { routePath: pathname } : {}),
			});
			toast.success("Prompt copiado");
		} else {
			toast.error("Não foi possível copiar o prompt");
		}
	}

	return (
		<>
			<PromptInputArea projectName={routeTarget.projectName} />

			<div className="mt-2 flex flex-wrap items-center gap-2">
				<SectionTrigger
					label="Anexos"
					hint="o que anexar ao prompt: /kw, caminho da rota e o texto digitado"
					open={attachOpen}
					onToggle={toggleAttachOpen}
				/>
				<SectionTrigger
					label="Estruturação"
					hint="estrutura do prompt (Goal, Contexto...) e preenchimento por IA"
					open={structureOpen}
					onToggle={toggleStructureOpen}
				/>
				<SectionTrigger
					label="Invocação"
					hint="alvo (agent/skill), knobs da sessão do CLI e o botão Invocar"
					open={invokeOpen}
					onToggle={toggleInvokeOpen}
				/>
				<SectionTrigger
					label="Conversa"
					hint="abre o prompt em um pane real do terminal"
					open={executeOpen}
					onToggle={toggleExecuteOpen}
				/>

				<div className="flex items-center">
					<SectionBulkButton
						label="Abrir todas as seções"
						icon={ChevronsUpDown}
						disabled={attachOpen && structureOpen && invokeOpen && executeOpen}
						onClick={() => setAllSectionsOpen(true)}
					/>
					<SectionBulkButton
						label="Fechar todas as seções"
						icon={ChevronsDownUp}
						disabled={!attachOpen && !structureOpen && !invokeOpen && !executeOpen}
						onClick={() => setAllSectionsOpen(false)}
					/>
				</div>

				<div className="ml-auto flex shrink-0 items-center gap-1">
					<Button
						size="sm"
						variant="outline"
						className="h-12 px-4 md:h-8 md:px-3"
						onClick={() => void handleCopy()}
					>
						<Copy size={14} />
						Copiar
					</Button>
					<Tooltip label={`Focar a sessão ${cliLabel} (abre uma se não houver)`}>
						<Button
							size="sm"
							variant="outline"
							aria-label={`Focar a sessão ${cliLabel} (abre uma se não houver)`}
							disabled={focusing}
							className="size-12 px-0 md:size-8"
							onClick={() => void handleFocusAgent()}
						>
							{focusing ? <Loader2 size={14} className="animate-spin" /> : <Crosshair size={14} />}
						</Button>
					</Tooltip>
				</div>
			</div>

			<CollapsibleSection open={attachOpen}>
				<div className="flex flex-wrap items-center gap-2">
					<GroupLabel>Anexar</GroupLabel>
					<ToggleBox
						label="kw"
						hint="prefixa a skill /kw na cabeça do prompt"
						checked={interactWithKw}
						onChange={setInteractWithKw}
					/>
					<ToggleBox
						label="rota"
						hint={routeTarget.path ? `caminho ${routeTarget.path}` : "esta rota não anexa caminho"}
						checked={interactWithRoute}
						disabled={!routeTarget.path}
						onChange={setInteractWithRoute}
					/>
					<ToggleBox
						label="input"
						hint="anexa o texto digitado (e a estrutura ativa) ao prompt"
						checked={interactWithInput}
						onChange={setInteractWithInput}
					/>
				</div>
			</CollapsibleSection>

			<CollapsibleSection open={structureOpen}>
				<AttachmentsPanel taskId={routeTarget.taskId} />
			</CollapsibleSection>

			<CollapsibleSection open={invokeOpen}>
				<InvokePanel
					projectId={routeTarget.projectId}
					projectName={routeTarget.projectName}
					routePath={routeTarget.path}
					nextStage={routeTarget.nextStage}
				/>
			</CollapsibleSection>

			<CollapsibleSection open={executeOpen}>
				<ExecutePanel
					projectId={routeTarget.projectId}
					projectName={routeTarget.projectName}
					routePath={routeTarget.path}
					taskId={routeTarget.taskId}
					nextStage={routeTarget.nextStage}
				/>
			</CollapsibleSection>
		</>
	);
}

function PromptInputArea({ projectName }: { projectName?: string }) {
	const text = usePromptBarStore((s) => s.text);
	const images = usePromptBarStore((s) => s.images);
	const expanded = usePromptBarStore((s) => s.expanded);
	const cli = usePromptBarStore((s) => s.cli);
	const setText = usePromptBarStore((s) => s.setText);
	const setImages = usePromptBarStore((s) => s.setImages);
	const setCli = usePromptBarStore((s) => s.setCli);

	const textareaRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		function handleFocusShortcut(event: KeyboardEvent) {
			if (event.code !== "Space" || !event.ctrlKey || event.altKey || event.metaKey) {
				return;
			}
			if (event.shiftKey) {
				return;
			}
			event.preventDefault();
			usePromptBarStore.getState().setExpanded(true);
			requestAnimationFrame(() => textareaRef.current?.focus());
		}

		window.addEventListener("keydown", handleFocusShortcut);
		return () => window.removeEventListener("keydown", handleFocusShortcut);
	}, []);

	return (
		<PromptField
			value={text}
			images={images}
			{...(projectName ? { projectName } : {})}
			cli={cli}
			placeholder="Instrução para o agente — digite / para inserir uma skill"
			inputClassName="max-h-64 min-h-20"
			inputRef={textareaRef}
			menuAbove
			clearShortcut={expanded}
			onChange={setText}
			onImagesChange={setImages}
			toolbar={
				<MiniSelect
					icon={Bot}
					value={cli}
					onChange={(value) => setCli(value as InvokeCli)}
					options={INVOKE_CLI_OPTIONS}
					ariaLabel="Selecionar CLI"
				/>
			}
		/>
	);
}

function SectionTrigger({
	label,
	hint,
	open,
	onToggle,
}: {
	label: string;
	hint: string;
	open: boolean;
	onToggle: () => void;
}) {
	return (
		<Tooltip label={hint}>
			<button
				type="button"
				onClick={onToggle}
				aria-expanded={open}
				className={cn(
					"flex h-12 items-center gap-1 border px-3 text-xs transition-colors md:h-7 md:px-2",
					"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
					open
						? "border-primary/40 bg-primary/10 text-foreground"
						: "border-border bg-card text-muted-foreground hover:border-muted-foreground hover:text-foreground",
				)}
			>
				<ChevronRight
					className={cn("size-3.5 transition-transform duration-150", open && "rotate-90")}
				/>
				{label}
			</button>
		</Tooltip>
	);
}

function SectionBulkButton({
	label,
	icon: Icon,
	disabled,
	onClick,
}: {
	label: string;
	icon: LucideIconType;
	disabled: boolean;
	onClick: () => void;
}) {
	return (
		<Tooltip label={label}>
			<button
				type="button"
				aria-label={label}
				disabled={disabled}
				onClick={onClick}
				className="flex size-12 items-center justify-center text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-40 disabled:hover:text-muted-foreground/60 md:size-6"
			>
				<Icon className="size-4 md:size-3.5" />
			</button>
		</Tooltip>
	);
}

function CollapsibleSection({ open, children }: { open: boolean; children: React.ReactNode }) {
	return (
		<Collapse open={open}>
			<div className="mt-2 border border-border/60 bg-muted/20 px-3 py-2.5">{children}</div>
		</Collapse>
	);
}
