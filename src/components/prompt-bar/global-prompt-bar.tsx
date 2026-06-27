import {
	ChevronUp,
	Copy,
	Eraser,
	FilePlus2,
	Link as LinkIcon,
	MessageSquarePlus,
	Slash,
	SquarePen,
} from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AgentInvokeButton, AgentPickerButton } from "@/components/prompt-bar/agent-invoke";
import { SkillInvokeButton, SkillPickerButton } from "@/components/prompt-bar/skill-invoke";
import { NewTaskDialog } from "@/components/prompt-bar/new-task-dialog";
import { NewVaultNoteDialog } from "@/components/prompt-bar/new-vault-note-dialog";
import { PromptHistoryMenu } from "@/components/prompt-bar/prompt-history-menu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip } from "@/components/ui/tooltip";
import { useSkillsQuery } from "@/hooks/use-skills";
import { useRouteDocTarget } from "@/hooks/use-route-doc-target";
import { buildKoworkerPrompt, copyToClipboard } from "@/lib/build-prompt";
import { LucideIcon } from "@/lib/lucide-icon";
import { recordPromptHistory } from "@/lib/prompt-history";
import { cn } from "@/lib/utils";
import { usePromptBarStore } from "@/stores/prompt-bar";
import { useReadingModeStore } from "@/stores/reading-mode";
import type { TaskAgent } from "@/types/agents";
import type { TaskSkill } from "@/types/skills";

type SlashTrigger = { triggerPos: number; query: string };

// O menu de skills só abre quando o "/" está no início do texto ou logo após um espaço/quebra —
// caminhos e URLs com "/" no meio de palavra não disparam.
function detectSlashTrigger(text: string, caret: number): SlashTrigger | null {
	for (let i = caret - 1; i >= 0; i--) {
		const char = text[i];
		if (char === "/") {
			const before = text[i - 1];
			if (i === 0 || before === " " || before === "\n") {
				return { triggerPos: i, query: text.slice(i + 1, caret) };
			}
			return null;
		}
		if (char === " " || char === "\n") {
			return null;
		}
	}
	return null;
}

function filterSkills(skills: TaskSkill[], query: string): TaskSkill[] {
	const term = query.trim().toLowerCase();
	if (!term) return skills;
	return skills.filter(
		(skill) =>
			skill.slug.toLowerCase().includes(term) ||
			skill.label.toLowerCase().includes(term) ||
			skill.description.toLowerCase().includes(term),
	);
}

// Footer global do prompt: vive acima da StatusBar em qualquer rota, persiste rascunho/estado,
// e — quando "interage com a rota" — anexa `/kw <alvo>` derivado da rota atual.
export function GlobalPromptBar() {
	const text = usePromptBarStore((s) => s.text);
	const expanded = usePromptBarStore((s) => s.expanded);
	const interactWithRoute = usePromptBarStore((s) => s.interactWithRoute);
	const interactWithInput = usePromptBarStore((s) => s.interactWithInput);
	const history = usePromptBarStore((s) => s.history);
	const setText = usePromptBarStore((s) => s.setText);
	const setExpanded = usePromptBarStore((s) => s.setExpanded);
	const toggleExpanded = usePromptBarStore((s) => s.toggleExpanded);
	const setInteractWithRoute = usePromptBarStore((s) => s.setInteractWithRoute);
	const setInteractWithInput = usePromptBarStore((s) => s.setInteractWithInput);
	const setHeight = usePromptBarStore((s) => s.setHeight);
	const clear = usePromptBarStore((s) => s.clear);
	const pushHistory = usePromptBarStore((s) => s.pushHistory);

	const reading = useReadingModeStore((s) => s.reading);
	const routeTarget = useRouteDocTarget();
	const { taskSkills } = useSkillsQuery(routeTarget.projectName);

	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const lastPathname = useRef(pathname);

	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const rootRef = useRef<HTMLDivElement>(null);

	// O footer se mede e publica a altura: na leitura ele é fixo e o conteúdo precisa desse respiro
	// inferior pra não ficar escondido atrás do drawer. ResizeObserver acompanha o textarea crescendo.
	useEffect(() => {
		const node = rootRef.current;
		if (!node) return;
		const observer = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height));
		observer.observe(node);
		return () => observer.disconnect();
	}, [setHeight]);

	const [trigger, setTrigger] = useState<SlashTrigger | null>(null);
	const [activeIndex, setActiveIndex] = useState(0);
	const [taskDialogOpen, setTaskDialogOpen] = useState(false);
	const [vaultDialogOpen, setVaultDialogOpen] = useState(false);
	// Agent e skill são mutuamente exclusivos numa invocação: o agent roda `/kw` sob um agent; a skill
	// roda `/<slug>` direto. Selecionar um limpa o outro.
	const [selectedAgent, setSelectedAgent] = useState<TaskAgent | null>(null);
	const [selectedSkill, setSelectedSkill] = useState<TaskSkill | null>(null);
	// `overflow-hidden` faz a animação de grid-rows clipar a altura; mas o menu de skill abre pra
	// cima e seria cortado. Então só liberamos `overflow-visible` quando a animação de abrir termina.
	const [revealed, setRevealed] = useState(expanded);

	useEffect(() => {
		if (!expanded) setRevealed(false);
	}, [expanded]);

	// Trocar de rota recolhe o prompt; o ref pula o mount pra preservar o `expanded` persistido no reload.
	useEffect(() => {
		if (lastPathname.current !== pathname) {
			lastPathname.current = pathname;
			setExpanded(false);
		}
	}, [pathname, setExpanded]);

	const matches = useMemo(
		() => (trigger ? filterSkills(taskSkills, trigger.query) : []),
		[trigger, taskSkills],
	);
	const menuOpen = trigger !== null && matches.length > 0;

	useEffect(() => {
		setActiveIndex(0);
	}, [trigger?.query]);

	const appendTarget = interactWithRoute ? routeTarget.path : null;

	function syncTrigger(value: string, caret: number) {
		setTrigger(detectSlashTrigger(value, caret));
	}

	function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
		const next = event.target.value;
		setText(next);
		syncTrigger(next, event.target.selectionStart);
	}

	function applySkill(skill: TaskSkill) {
		if (!trigger) return;
		const caret = textareaRef.current?.selectionStart ?? text.length;
		const insertion = `/${skill.slug} `;
		const next = text.slice(0, trigger.triggerPos) + insertion + text.slice(caret);
		const nextCaret = trigger.triggerPos + insertion.length;
		setText(next);
		setTrigger(null);
		requestAnimationFrame(() => {
			const node = textareaRef.current;
			if (!node) return;
			node.focus();
			node.setSelectionRange(nextCaret, nextCaret);
		});
	}

	function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
		if (!menuOpen) return;
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setActiveIndex((index) => (index + 1) % matches.length);
			return;
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			setActiveIndex((index) => (index - 1 + matches.length) % matches.length);
			return;
		}
		if (event.key === "Enter" || event.key === "Tab") {
			event.preventDefault();
			applySkill(matches[activeIndex]);
			return;
		}
		if (event.key === "Escape") {
			event.preventDefault();
			setTrigger(null);
		}
	}

	async function handleCopy() {
		const prompt = buildKoworkerPrompt({ target: appendTarget, text });
		if (!prompt.trim()) {
			toast.info("Nada para copiar");
			return;
		}
		const ok = await copyToClipboard(prompt);
		if (ok) {
			pushHistory(text);
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

	async function handleCopyRoutePath() {
		if (!routeTarget.path) return;
		const ok = await copyToClipboard(routeTarget.path);
		toast[ok ? "success" : "error"](ok ? "Caminho copiado" : "Falha ao copiar caminho");
	}

	function insertSlash() {
		setExpanded(true);
		requestAnimationFrame(() => {
			const el = textareaRef.current;
			if (!el) return;
			el.focus();
			const caret = el.selectionStart ?? text.length;
			const before = text.slice(0, caret);
			const needsSpace = before.length > 0 && !before.endsWith(" ") && !before.endsWith("\n");
			const insertion = `${needsSpace ? " " : ""}/`;
			const next = before + insertion + text.slice(caret);
			const nextCaret = before.length + insertion.length;
			setText(next);
			requestAnimationFrame(() => {
				const inner = textareaRef.current;
				if (!inner) return;
				inner.setSelectionRange(nextCaret, nextCaret);
				syncTrigger(next, nextCaret);
			});
		});
	}

	const contextLabel = appendTarget
		? `anexa /kw ${appendTarget}`
		: interactWithRoute
			? "esta rota não anexa caminho"
			: "anexa só o texto";

	const hasText = text.trim().length > 0;

	return (
		<div
			ref={rootRef}
			className={cn(
				"border-t border-border bg-chrome",
				// Na leitura a rota vira um overlay `fixed inset-0 z-50`; o footer precisa sair do fluxo
				// e encostar no fim da janela (sobre o lugar da StatusBar), com z acima do overlay.
				reading && "fixed inset-x-0 bottom-0 z-[60]",
			)}
		>
			<div
				className={cn(
					"transition-opacity",
					// Na leitura o footer fica sutil sobre o overlay, igual às tabs do topo.
					reading && "opacity-40 hover:opacity-100 focus-within:opacity-100",
				)}
			>
				{/* Header sempre presente: o chevron fica fixo à direita e só rotaciona ao abrir/fechar. */}
				<button
					type="button"
					onClick={toggleExpanded}
					className="flex h-9 w-full cursor-pointer items-center gap-2 px-4 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				>
					<MessageSquarePlus className="h-4 w-4 shrink-0" />
					<span className="shrink-0">Prompt</span>
					<span className="min-w-0 flex-1">
						{!expanded &&
							(hasText ? (
								<span className="flex min-w-0 items-center gap-2">
									<span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
									<span className="min-w-0 flex-1 truncate text-muted-foreground/80">
										{text.trim()}
									</span>
								</span>
							) : (
								<span className="block truncate text-muted-foreground/50">
									Escreva uma instrução para o agente
								</span>
							))}
					</span>
					<ChevronUp
						className={cn(
							"h-4 w-4 shrink-0 transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]",
							expanded && "rotate-180",
						)}
					/>
				</button>

				{/* Conteúdo expansível: grid-rows 0fr→1fr anima a altura sem medir nada. */}
				<div
					className={cn(
						"grid transition-[grid-template-rows] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]",
						expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
					)}
					onTransitionEnd={(event) => {
						if (event.propertyName === "grid-template-rows" && expanded) setRevealed(true);
					}}
				>
					<div className={cn("min-h-0", revealed ? "overflow-visible" : "overflow-hidden")}>
						<div className="mx-auto w-full max-w-3xl px-4 pb-3 xl:max-w-4xl">
							<div className="relative">
								{menuOpen && (
									<div className="absolute bottom-full left-0 z-20 mb-2 max-h-72 w-full overflow-y-auto border border-border bg-popover shadow-md animate-in fade-in-0 slide-in-from-bottom-1 duration-150">
										{matches.map((skill, index) => (
											<button
												key={skill.slug}
												type="button"
												onMouseDown={(event) => {
													event.preventDefault();
													applySkill(skill);
												}}
												onMouseEnter={() => setActiveIndex(index)}
												className={cn(
													"flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
													index === activeIndex ? "bg-secondary" : "hover:bg-secondary/50",
												)}
											>
												<div
													className="flex h-7 w-7 shrink-0 items-center justify-center border bg-muted/30"
													style={{ borderColor: skill.color, color: skill.color }}
												>
													<LucideIcon name={skill.icon} className="size-4" />
												</div>
												<div className="min-w-0 flex-1">
													<div className="truncate font-mono text-sm text-foreground">
														/{skill.slug}
													</div>
													<div className="truncate text-xs text-muted-foreground">
														{skill.description}
													</div>
												</div>
											</button>
										))}
									</div>
								)}

								<textarea
									ref={textareaRef}
									value={text}
									onChange={handleChange}
									onKeyDown={handleKeyDown}
									onSelect={(event) =>
										syncTrigger(event.currentTarget.value, event.currentTarget.selectionStart)
									}
									placeholder="Instrução para o agente — digite / para inserir uma skill"
									className={cn(
										"flex max-h-64 min-h-20 w-full resize-none rounded-none border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-colors field-sizing-content",
										"placeholder:text-muted-foreground",
										"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-ring",
									)}
								/>
							</div>

							<div className="mt-2 flex items-center gap-2">
								{/* Grupo 1 — atalhos que mexem no input. */}
								<div className="flex shrink-0 items-center gap-1">
									<MiniMenuButton
										icon={Eraser}
										label="Limpar"
										onClick={clear}
										disabled={!hasText}
									/>
									<MiniMenuButton
										icon={SquarePen}
										label="Nova tarefa"
										onClick={() => setTaskDialogOpen(true)}
									/>
									<MiniMenuButton
										icon={FilePlus2}
										label="Nova nota no vault"
										onClick={() => setVaultDialogOpen(true)}
									/>
									<PromptHistoryMenu history={history} onPick={setText} />
									<MiniMenuButton icon={Slash} label="Inserir skill (/)" onClick={insertSlash} />
									<AgentPickerButton
										selected={selectedAgent}
										onSelect={(agent) => {
											setSelectedSkill(null);
											setSelectedAgent(agent);
										}}
										onClear={() => setSelectedAgent(null)}
										canPick={!!routeTarget.projectName}
									/>
									<SkillPickerButton
										selected={selectedSkill}
										onSelect={(skill) => {
											setSelectedAgent(null);
											setSelectedSkill(skill);
										}}
										onClear={() => setSelectedSkill(null)}
										projectName={routeTarget.projectName}
									/>
								</div>

								<div className="h-5 w-px shrink-0 bg-border" aria-hidden />

								{/* Grupo 2 — atalho e checkbox que interferem na rota; o "anexa…" mora ao lado deles. */}
								<div className="flex min-w-0 flex-1 items-center gap-2">
									<MiniMenuButton
										icon={LinkIcon}
										label="Copiar caminho da rota"
										onClick={() => void handleCopyRoutePath()}
										disabled={!routeTarget.path}
									/>
									<span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground opacity-70">
										{contextLabel}
									</span>
									<Tooltip label="Anexa o caminho da rota ao prompt (/kw)">
										<label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
											<Checkbox
												size="sm"
												checked={interactWithRoute}
												onCheckedChange={(checked) => setInteractWithRoute(checked === true)}
											/>
											rota
										</label>
									</Tooltip>
									<Tooltip label="Anexa o texto do prompt ao invocar skill ou agent">
										<label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
											<Checkbox
												size="sm"
												checked={interactWithInput}
												onCheckedChange={(checked) => setInteractWithInput(checked === true)}
											/>
											input
										</label>
									</Tooltip>
								</div>

								{/* Grupo 3 — ações principais. "Invocar agent/skill" só aparece com um deles ativo. */}
								{selectedAgent && (
									<AgentInvokeButton
										agent={selectedAgent}
										target={appendTarget}
										withInput={interactWithInput}
										projectName={routeTarget.projectName}
										onInvoked={() => setSelectedAgent(null)}
									/>
								)}
								{selectedSkill && (
									<SkillInvokeButton
										skill={selectedSkill}
										target={appendTarget}
										withInput={interactWithInput}
										projectName={routeTarget.projectName}
										onInvoked={() => setSelectedSkill(null)}
									/>
								)}
								<Button size="sm" className="shrink-0" onClick={() => void handleCopy()}>
									<Copy size={14} />
									Copiar prompt
								</Button>
							</div>
						</div>
					</div>
				</div>
			</div>

			<NewTaskDialog open={taskDialogOpen} onClose={() => setTaskDialogOpen(false)} />
			<NewVaultNoteDialog open={vaultDialogOpen} onClose={() => setVaultDialogOpen(false)} />
		</div>
	);
}

function MiniMenuButton({
	icon: Icon,
	label,
	onClick,
	disabled,
}: {
	icon: typeof Eraser;
	label: string;
	onClick: () => void;
	disabled?: boolean;
}) {
	return (
		<Tooltip label={label}>
			<button
				type="button"
				onClick={onClick}
				disabled={disabled}
				aria-label={label}
				className="flex h-6 w-6 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
			>
				<Icon className="h-3.5 w-3.5" />
			</button>
		</Tooltip>
	);
}
