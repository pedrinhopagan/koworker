import {
	ChevronRight,
	ChevronsDownUp,
	ChevronsUpDown,
	ChevronUp,
	Copy,
	Eraser,
	Loader2,
	MessageSquarePlus,
	type LucideIcon as LucideIconType,
} from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AttachmentsPanel } from "@/components/prompt-bar/attachments-panel";
import { ExecutePanel } from "@/components/prompt-bar/execute-panel";
import { Collapse, GroupLabel, ToggleBox } from "@/components/prompt-bar/controls";
import { InvokePanel } from "@/components/prompt-bar/invoke-panel";
import {
	PromptImageChips,
	PromptInputBackdrop,
	usePromptImagePaste,
} from "@/components/prompt-bar/prompt-images";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useSkillsQuery } from "@/hooks/use-skills";
import { useRouteDocTarget } from "@/hooks/use-route-doc-target";
import {
	buildKoworkerPrompt,
	buildPromptBody,
	convertSkillCallsForCli,
	copyToClipboard,
	imagePlaceholder,
} from "@/lib/build-prompt";
import { LucideIcon } from "@/lib/lucide-icon";
import { PromptUndoHistory, type PromptSnapshot } from "@/lib/prompt-undo";
import { recordPromptHistory } from "@/lib/prompt-history";
import { cn } from "@/lib/utils";
import { usePromptBarStore } from "@/stores/prompt-bar";
import { useReadingModeStore } from "@/stores/reading-mode";
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
// e — quando "interage com a rota" — anexa `/kw <alvo>` derivado da rota atual. Abaixo do textarea:
// só a linha de triggers (Anexos | Estruturação | Invocação) à esquerda e o Copiar à direita; cada
// trigger revela sua seção. O CLI de trabalho vive na StatusBar (é global); o Invocar mora na
// seção "Invocação", junto do Alvo.
export function GlobalPromptBar() {
	// A barra inteira (triggers, painéis, tooltips) não pode re-renderizar a cada tecla — o texto vivo
	// mora no PromptInputArea. Aqui só entram derivações estáveis durante a digitação: o booleano de
	// "tem texto" e o preview do cabeçalho, que só existe recolhido (digitar exige a barra aberta).
	const hasText = usePromptBarStore((s) => s.text.trim().length > 0);
	const collapsedText = usePromptBarStore((s) => (s.expanded ? null : s.text.trim()));
	const expanded = usePromptBarStore((s) => s.expanded);
	const cli = usePromptBarStore((s) => s.cli);
	const invokeOpen = usePromptBarStore((s) => s.invokeOpen);
	const executeOpen = usePromptBarStore((s) => s.executeOpen);
	const attachOpen = usePromptBarStore((s) => s.attachOpen);
	const structureOpen = usePromptBarStore((s) => s.structureOpen);
	const interactWithKw = usePromptBarStore((s) => s.interactWithKw);
	const interactWithRoute = usePromptBarStore((s) => s.interactWithRoute);
	const interactWithInput = usePromptBarStore((s) => s.interactWithInput);
	const setExpanded = usePromptBarStore((s) => s.setExpanded);
	const toggleExpanded = usePromptBarStore((s) => s.toggleExpanded);
	const toggleInvokeOpen = usePromptBarStore((s) => s.toggleInvokeOpen);
	const toggleExecuteOpen = usePromptBarStore((s) => s.toggleExecuteOpen);
	const toggleAttachOpen = usePromptBarStore((s) => s.toggleAttachOpen);
	const toggleStructureOpen = usePromptBarStore((s) => s.toggleStructureOpen);
	const setAllSectionsOpen = usePromptBarStore((s) => s.setAllSectionsOpen);
	const setInteractWithKw = usePromptBarStore((s) => s.setInteractWithKw);
	const setInteractWithRoute = usePromptBarStore((s) => s.setInteractWithRoute);
	const setInteractWithInput = usePromptBarStore((s) => s.setInteractWithInput);
	const setStructureTemplate = usePromptBarStore((s) => s.setStructureTemplate);

	const reading = useReadingModeStore((s) => s.reading);
	const routeTarget = useRouteDocTarget();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const lastPathname = useRef(pathname);

	const rootRef = useRef<HTMLDivElement>(null);

	// O footer se mede e publica --prompt-bar-h no :root: na leitura ele é fixo e o conteúdo precisa
	// desse respiro inferior pra não ficar escondido atrás do drawer. ResizeObserver acompanha o
	// textarea crescendo. Só observa em modo leitura (único consumidor da variável): fora dele, cada
	// frame da animação de abrir/fechar escreveria no :root e forçaria recálculo de estilo da página
	// inteira — era isso que deixava o abrir/fechar do prompt lento nas rotas pesadas.
	useEffect(() => {
		if (!reading) return;
		const node = rootRef.current;
		if (!node) return;
		const observer = new ResizeObserver(([entry]) => {
			document.documentElement.style.setProperty("--prompt-bar-h", `${entry.contentRect.height}px`);
		});
		observer.observe(node);
		return () => {
			observer.disconnect();
			document.documentElement.style.removeProperty("--prompt-bar-h");
		};
	}, [reading]);

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

	// Autosugestão: ao abrir uma tarefa cuja categoria tem estrutura vinculada, pré-seleciona o
	// template — só uma vez por tarefa e só quando nenhum template está ativo. Ler o estado direto
	// (getState) mantém a escolha manual soberana: limpar o template dentro da mesma tarefa não
	// dispara nova sugestão, e trocar de tarefa reancora pela mudança de taskId.
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

	async function handleCopy() {
		// Os mesmos toggles de Anexar governam o que entra aqui — o preview do painel de invocação
		// mostra exatamente esta string, então copiar não tem surpresa. O corpo compõe a estrutura
		// (template ativo) antes do texto livre; o CLI ativo decide a grafia das skills (`/` vs `$`).
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
					"relative transition-opacity",
					// Na leitura o footer fica sutil sobre o overlay, igual às tabs do topo.
					reading && "opacity-40 hover:opacity-100 focus-within:opacity-100",
				)}
			>
				{/* Header sempre presente: o chevron fica fixo à direita e só rotaciona ao abrir/fechar. */}
				<button
					type="button"
					onClick={toggleExpanded}
					className={cn(
						"flex h-9 w-full cursor-pointer items-center gap-2 px-4 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
						expanded && "bg-muted/40 text-foreground",
					)}
				>
					<MessageSquarePlus className="h-4 w-4 shrink-0" />
					<span className="shrink-0">Prompt</span>
					<span className="min-w-0 flex-1">
						{!expanded &&
							(hasText ? (
								<span className="flex min-w-0 items-center gap-2">
									<span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
									<span className="min-w-0 flex-1 truncate text-muted-foreground/80">
										{collapsedText}
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

				<div
					className={cn(
						"grid transition-[grid-template-rows,visibility] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
						expanded ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]",
					)}
					onTransitionEnd={(event) => {
						if (event.propertyName === "grid-template-rows" && expanded) setRevealed(true);
					}}
				>
					<div
						className={cn(
							"flex min-h-0 flex-col justify-end",
							revealed ? "overflow-visible" : "overflow-hidden",
						)}
					>
						<div className={cn(!reading && "border-t border-border bg-chrome pt-3")}>
							<div className="mx-auto w-full max-w-3xl px-4 pb-3 xl:max-w-4xl">
								<PromptInputArea projectName={routeTarget.projectName} />

								<PromptImageChips />

								{/* Triggers das três seções à esquerda; o Copiar sozinho à direita. Cada trigger
								    revela sua seção logo abaixo. O Invocar mora dentro da seção "Invocação". */}
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
										label="Execução"
										hint="roda o prompt no projeto sem abrir terminal (headless)"
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

									<div className="ml-auto shrink-0">
										<Button size="sm" variant="outline" onClick={() => void handleCopy()}>
											<Copy size={14} />
											Copiar
										</Button>
									</div>
								</div>

								{/* Seção "Anexos": os toggles que governam tanto o Copiar quanto o Invocar. */}
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
											hint={
												routeTarget.path
													? `caminho ${routeTarget.path}`
													: "esta rota não anexa caminho"
											}
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

								{/* Seção "Estruturação": revelada pelo trigger homônimo. Fica montada pra preservar
								    o template ativo e os campos entre aberturas. */}
								<CollapsibleSection open={structureOpen}>
									<AttachmentsPanel taskId={routeTarget.taskId} />
								</CollapsibleSection>

								{/* Seção "Invocação": revelada pelo trigger homônimo. grid-rows 0fr→1fr anima a
								    altura e o conteúdo desliza/desvanece junto. Fica montada pra preservar o alvo
								    escolhido; os popovers do alvo são portalados, então o overflow-hidden não os clipa. */}
								<CollapsibleSection open={invokeOpen}>
									<InvokePanel
										projectName={routeTarget.projectName}
										routePath={routeTarget.path}
										nextStage={routeTarget.nextStage}
									/>
								</CollapsibleSection>

								<CollapsibleSection open={executeOpen}>
									<ExecutePanel
										projectName={routeTarget.projectName}
										routePath={routeTarget.path}
										taskId={routeTarget.taskId}
										nextStage={routeTarget.nextStage}
									/>
								</CollapsibleSection>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

// Dono do texto vivo: só esta subárvore re-renderiza a cada tecla. Concentra o textarea, o backdrop
// de chips, o menu de skills do "/", o overlay de upload e a borracha — tudo que precisa do texto
// caractere a caractere fica aqui, isolado do resto da barra.
function PromptInputArea({ projectName }: { projectName?: string }) {
	const text = usePromptBarStore((s) => s.text);
	const images = usePromptBarStore((s) => s.images);
	const setText = usePromptBarStore((s) => s.setText);
	const reconcileImages = usePromptBarStore((s) => s.reconcileImages);
	const restoreDraft = usePromptBarStore((s) => s.restoreDraft);
	const clear = usePromptBarStore((s) => s.clear);

	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const backdropRef = useRef<HTMLDivElement>(null);

	const [undoHistory] = useState(() => new PromptUndoHistory());
	const snapshotRef = useRef<PromptSnapshot>({ text, caret: text.length, images });

	useEffect(() => {
		if (snapshotRef.current.text === text) {
			snapshotRef.current.images = images;
			return;
		}
		undoHistory.record(snapshotRef.current, text);
		snapshotRef.current = { text, caret: text.length, images };
	}, [text, images, undoHistory]);

	const { handlePaste, uploading } = usePromptImagePaste({ projectName, textareaRef });

	useEffect(() => {
		function handleGlobalShortcut(event: KeyboardEvent) {
			if (
				!event.ctrlKey ||
				event.code !== "Space" ||
				event.altKey ||
				event.metaKey ||
				event.shiftKey
			) {
				return;
			}

			event.preventDefault();
			usePromptBarStore.getState().setExpanded(true);
			requestAnimationFrame(() => textareaRef.current?.focus());
		}

		window.addEventListener("keydown", handleGlobalShortcut);
		return () => window.removeEventListener("keydown", handleGlobalShortcut);
	}, []);

	const [trigger, setTrigger] = useState<SlashTrigger | null>(null);
	const [activeIndex, setActiveIndex] = useState(0);
	const { taskSkills } = useSkillsQuery(projectName, { enabled: trigger !== null });

	const matches = useMemo(
		() => (trigger ? filterSkills(taskSkills, trigger.query) : []),
		[trigger, taskSkills],
	);
	const menuOpen = trigger !== null && matches.length > 0;

	useEffect(() => {
		setActiveIndex(0);
	}, [trigger?.query]);

	function syncTrigger(value: string, caret: number) {
		setTrigger(detectSlashTrigger(value, caret));
	}

	function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
		const next = event.target.value;
		undoHistory.record(snapshotRef.current, next);
		snapshotRef.current = { text: next, caret: event.target.selectionStart, images };
		setText(next);
		// Recortar, selecionar-e-apagar ou editar um marcador é o texto perdendo o token: a imagem cai
		// junto (o Backspace/Delete de um token inteiro é tratado antes, no keydown, sem passar por aqui).
		reconcileImages(next);
		syncTrigger(next, event.target.selectionStart);
	}

	// Um `[Imagem N]` encostado no caret sai como uma unidade: um Backspace (token antes) ou Delete
	// (token depois) apaga o marcador inteiro e solta a imagem — nada de comer caractere por caractere.
	function deleteAdjacentImageToken(event: React.KeyboardEvent<HTMLTextAreaElement>): boolean {
		if (event.key !== "Backspace" && event.key !== "Delete") return false;
		if (event.metaKey || event.ctrlKey || event.altKey) return false;

		const node = textareaRef.current;
		if (!node || node.selectionStart !== node.selectionEnd) return false;

		const caret = node.selectionStart;
		const before = event.key === "Backspace";

		for (const image of images) {
			const token = imagePlaceholder(image.index);
			const start = before ? caret - token.length : caret;
			const end = before ? caret : caret + token.length;
			if (start < 0 || text.slice(start, end) !== token) continue;

			event.preventDefault();
			const next = text.slice(0, start) + text.slice(end);
			setText(next);
			reconcileImages(next);
			requestAnimationFrame(() => {
				node.focus();
				node.setSelectionRange(start, start);
			});
			return true;
		}

		return false;
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

	function handleUndoRedo(event: React.KeyboardEvent<HTMLTextAreaElement>): boolean {
		if (!(event.ctrlKey || event.metaKey) || event.altKey) return false;

		const key = event.key.toLowerCase();
		if (key !== "z" && key !== "y") return false;

		event.preventDefault();
		const isRedo = key === "y" || event.shiftKey;
		const snapshot = isRedo
			? undoHistory.redo(snapshotRef.current)
			: undoHistory.undo(snapshotRef.current);
		if (!snapshot) return true;

		snapshotRef.current = snapshot;
		restoreDraft({ text: snapshot.text, images: snapshot.images });
		setTrigger(null);
		requestAnimationFrame(() => {
			const node = textareaRef.current;
			if (!node) return;
			node.focus();
			node.setSelectionRange(snapshot.caret, snapshot.caret);
		});
		return true;
	}

	function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
		if (handleUndoRedo(event)) return;
		if (deleteAdjacentImageToken(event)) return;
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

	return (
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
								<div className="truncate font-mono text-sm text-foreground">/{skill.slug}</div>
								<div className="truncate text-xs text-muted-foreground">{skill.description}</div>
							</div>
						</button>
					))}
				</div>
			)}

			<PromptInputBackdrop text={text} scrollRef={backdropRef} />

			<textarea
				ref={textareaRef}
				value={text}
				onChange={handleChange}
				onKeyDown={handleKeyDown}
				onSelect={(event) => {
					if (snapshotRef.current.text === event.currentTarget.value) {
						snapshotRef.current.caret = event.currentTarget.selectionStart;
					}
					syncTrigger(event.currentTarget.value, event.currentTarget.selectionStart);
				}}
				onPaste={(event) => void handlePaste(event)}
				onScroll={(event) => {
					if (backdropRef.current) backdropRef.current.scrollTop = event.currentTarget.scrollTop;
				}}
				disabled={uploading}
				placeholder="Instrução para o agente — digite / para inserir uma skill"
				className={cn(
					"relative flex max-h-64 min-h-20 w-full resize-none rounded-none border border-input bg-transparent px-3 py-2 pr-9 text-base shadow-xs transition-colors field-sizing-content",
					"placeholder:text-muted-foreground/20",
					"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-ring",
					"disabled:cursor-not-allowed",
				)}
			/>

			{/* Enquanto a imagem sobe, o input trava: colar de novo no meio da gravação bagunçaria a
			    ordem dos marcadores. O overlay cobre o textarea com um respiro e o spinner. */}
			{uploading && (
				<div className="absolute inset-0 z-10 flex items-center justify-center gap-2 border border-input bg-card/70 text-sm text-muted-foreground backdrop-blur-[1px]">
					<Loader2 className="size-4 animate-spin" />
					Colando imagem…
				</div>
			)}

			{/* Borracha no canto do textarea: limpa exatamente o que está ali. */}
			{text.trim().length > 0 && (
				<Tooltip label="Limpar texto" triggerClassName="absolute right-2 top-2">
					<button
						type="button"
						onClick={clear}
						aria-label="Limpar texto"
						className="flex size-6 items-center justify-center text-muted-foreground/60 transition-colors hover:text-foreground"
					>
						<Eraser className="size-3.5" />
					</button>
				</Tooltip>
			)}
		</div>
	);
}

// Trigger de seção colapsável: nomeia o que abre e mostra o estado pelo chevron.
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
					"flex h-7 items-center gap-1 border px-2 text-xs transition-colors",
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
				className="flex size-6 items-center justify-center text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-40 disabled:hover:text-muted-foreground/60"
			>
				<Icon className="size-3.5" />
			</button>
		</Tooltip>
	);
}

// Seção colapsável do footer: o Collapse anima; o cartão bordado delimita cada seção aberta, então
// várias abertas ao mesmo tempo aparecem como blocos distintos em vez de linhas coladas.
function CollapsibleSection({ open, children }: { open: boolean; children: React.ReactNode }) {
	return (
		<Collapse open={open}>
			<div className="mt-2 border border-border/60 bg-muted/20 px-3 py-2.5">{children}</div>
		</Collapse>
	);
}
