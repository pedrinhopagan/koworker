import { Eraser, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AgentCliIcon } from "@/components/agent-radar/agent-cli";
import {
	PromptImageChips,
	PromptInputBackdrop,
	usePromptImagePaste,
} from "@/components/prompt-bar/prompt-images";
import { Tooltip } from "@/components/ui/tooltip";
import { useSkillsQuery } from "@/hooks/use-skills";
import { imagePlaceholder, nextImageIndex } from "@/lib/build-prompt";
import { LucideIcon } from "@/lib/lucide-icon";
import { PromptUndoHistory, type PromptSnapshot } from "@/lib/prompt-undo";
import { buildSlashItems, searchSlashItems, type SlashItem } from "@/lib/slash-menu";
import { cn } from "@/lib/utils";
import type { PromptImage } from "@/stores/prompt-bar";

type SlashTrigger = { triggerPos: number; query: string };

const CLEAR_CONFIRM_MS = 2500;
const FIELD_METRICS = "px-3 py-2 text-base leading-6";

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

export function PromptField({
	value,
	images,
	projectName,
	cli,
	placeholder,
	disabled,
	className,
	inputClassName,
	menuAbove,
	clearShortcut,
	inputRef,
	onChange,
	onImagesChange,
	onSubmit,
}: {
	value: string;
	images: PromptImage[];
	projectName?: string;
	cli?: string;
	placeholder: string;
	disabled?: boolean;
	className?: string;
	inputClassName?: string;
	menuAbove?: boolean;
	clearShortcut?: boolean;
	inputRef?: React.RefObject<HTMLTextAreaElement | null>;
	onChange: (text: string) => void;
	onImagesChange: (images: PromptImage[]) => void;
	onSubmit?: (text?: string) => void;
}) {
	const fallbackRef = useRef<HTMLTextAreaElement>(null);
	const textareaRef = inputRef ?? fallbackRef;
	const backdropRef = useRef<HTMLDivElement>(null);

	const [undoHistory] = useState(() => new PromptUndoHistory());
	const snapshotRef = useRef<PromptSnapshot>({
		text: value,
		caret: value.length,
		images,
	});

	useEffect(() => {
		if (snapshotRef.current.text === value) {
			snapshotRef.current.images = images;
			return;
		}
		undoHistory.record(snapshotRef.current, value);
		snapshotRef.current = { text: value, caret: value.length, images };
	}, [value, images, undoHistory]);

	function commit(next: string) {
		onChange(next);
		const kept = images.filter((image) => next.includes(imagePlaceholder(image.index)));
		if (kept.length !== images.length) {
			onImagesChange(kept);
		}
	}

	function clearAll() {
		onChange("");
		onImagesChange([]);
	}

	function moveCaret(caret: number) {
		requestAnimationFrame(() => {
			const node = textareaRef.current;
			if (!node) return;
			node.focus();
			node.setSelectionRange(caret, caret);
		});
	}

	const { handlePaste, uploading } = usePromptImagePaste({
		...(projectName ? { projectName } : {}),
		onUploaded: (uploaded) => {
			const base = nextImageIndex(images);
			const added = uploaded.map((image, offset) => ({
				...image,
				index: base + offset,
			}));
			const node = textareaRef.current;
			const start = node?.selectionStart ?? value.length;
			const end = node?.selectionEnd ?? start;
			const snippet = added.map((image) => imagePlaceholder(image.index)).join(" ");

			onImagesChange([...images, ...added]);
			onChange(value.slice(0, start) + snippet + value.slice(end));
			moveCaret(start + snippet.length);
		},
	});

	const [clearArmed, setClearArmed] = useState(false);
	const clearArmedRef = useRef(false);
	const clearArmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const clearAllRef = useRef(clearAll);
	clearAllRef.current = clearAll;

	function setClearArm(armed: boolean) {
		clearArmedRef.current = armed;
		setClearArmed(armed);
		if (clearArmTimer.current) {
			clearTimeout(clearArmTimer.current);
			clearArmTimer.current = null;
		}
		if (armed) {
			clearArmTimer.current = setTimeout(() => {
				clearArmedRef.current = false;
				setClearArmed(false);
			}, CLEAR_CONFIRM_MS);
		}
	}

	const clearShortcutActive = !!clearShortcut;
	useEffect(() => {
		function handleShortcut(event: KeyboardEvent) {
			if (event.code !== "Space" || !event.altKey || event.ctrlKey || event.metaKey) {
				return;
			}
			if (event.shiftKey) {
				return;
			}

			const focused = document.activeElement;
			const focusedElsewhere =
				focused !== textareaRef.current &&
				(focused instanceof HTMLTextAreaElement ||
					focused instanceof HTMLInputElement ||
					(focused instanceof HTMLElement && focused.isContentEditable));
			if (focusedElsewhere || (!clearShortcutActive && focused !== textareaRef.current)) {
				return;
			}

			event.preventDefault();
			if (!clearArmedRef.current) {
				if (textareaRef.current?.value.trim()) {
					setClearArm(true);
				}
				return;
			}

			setClearArm(false);
			clearAllRef.current();
			requestAnimationFrame(() => textareaRef.current?.focus());
		}

		window.addEventListener("keydown", handleShortcut);
		return () => window.removeEventListener("keydown", handleShortcut);
	}, [clearShortcutActive, textareaRef]);

	useEffect(() => {
		return () => {
			if (clearArmTimer.current) {
				clearTimeout(clearArmTimer.current);
			}
		};
	}, []);

	const [trigger, setTrigger] = useState<SlashTrigger | null>(null);
	const [activeIndex, setActiveIndex] = useState(0);
	const { taskSkills } = useSkillsQuery(projectName, {
		enabled: trigger !== null,
	});

	// Barra na primeira coluna é comando da CLI mais skill; no meio do texto, só skill.
	const atStart = trigger?.triggerPos === 0;
	const matches = useMemo(
		() =>
			trigger
				? searchSlashItems(
						buildSlashItems({
							skills: taskSkills,
							...(cli ? { cli } : {}),
							atStart,
						}),
						trigger.query,
					)
				: [],
		[trigger, taskSkills, cli, atStart],
	);
	const menuOpen = trigger !== null && matches.length > 0;
	const highlighted = Math.min(activeIndex, Math.max(matches.length - 1, 0));

	useEffect(() => {
		setActiveIndex(0);
	}, [trigger?.query]);

	function syncTrigger(text: string, caret: number) {
		setTrigger(detectSlashTrigger(text, caret));
	}

	function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
		if (clearArmedRef.current) {
			setClearArm(false);
		}
		const next = event.target.value;
		undoHistory.record(snapshotRef.current, next);
		snapshotRef.current = {
			text: next,
			caret: event.target.selectionStart,
			images,
		};
		commit(next);
		syncTrigger(next, event.target.selectionStart);
	}

	function applyItem(item: SlashItem, submit = false) {
		if (!trigger) return;
		const caret = textareaRef.current?.selectionStart ?? value.length;
		const insertion = `/${item.name} `;
		const next = value.slice(0, trigger.triggerPos) + insertion + value.slice(caret);

		commit(next);
		setTrigger(null);

		if (submit && onSubmit) {
			onSubmit(next.trim());
			return;
		}

		moveCaret(trigger.triggerPos + insertion.length);
	}

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
			if (start < 0 || value.slice(start, end) !== token) continue;

			event.preventDefault();
			commit(value.slice(0, start) + value.slice(end));
			moveCaret(start);
			return true;
		}

		return false;
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
		onChange(snapshot.text);
		onImagesChange(snapshot.images);
		setTrigger(null);
		moveCaret(snapshot.caret);
		return true;
	}

	function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
		if (handleUndoRedo(event)) return;
		if (deleteAdjacentImageToken(event)) return;

		if (menuOpen) {
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
			// Tab completa e devolve o cursor; Enter na primeira coluna despacha na hora, como na CLI.
			if (event.key === "Tab" || (event.key === "Enter" && !event.shiftKey)) {
				event.preventDefault();
				applyItem(matches[highlighted], event.key === "Enter" && atStart);
				return;
			}
			if (event.key === "Escape") {
				event.preventDefault();
				setTrigger(null);
				return;
			}
		}

		if (!onSubmit || event.key !== "Enter") {
			return;
		}

		if (event.ctrlKey || event.metaKey) {
			event.preventDefault();
			onSubmit();
			return;
		}

		// Linha que começa com barra é comando: uma linha só, enviada com Enter seco.
		if (!event.shiftKey && !event.altKey && value.startsWith("/") && !value.includes("\n")) {
			event.preventDefault();
			onSubmit(value.trim());
		}
	}

	return (
		<div className={cn("flex min-w-0 flex-col", className)}>
			<div className="relative">
				{menuOpen && (
					<div
						className={cn(
							"absolute top-full left-0 z-20 mt-2 max-h-72 w-full overflow-y-auto border border-border bg-popover shadow-md animate-in fade-in-0 slide-in-from-bottom-1 duration-150",
							menuAbove && "md:top-auto md:bottom-full md:mt-0 md:mb-2",
						)}
					>
						{matches.map((item, index) => (
							<button
								key={item.key}
								type="button"
								onMouseDown={(event) => {
									event.preventDefault();
									applyItem(item);
								}}
								onMouseEnter={() => setActiveIndex(index)}
								className={cn(
									"flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left transition-colors",
									index === highlighted ? "bg-secondary" : "hover:bg-secondary/50",
								)}
							>
								{item.kind === "command" ? (
									<div className="flex h-7 w-7 shrink-0 items-center justify-center border border-border bg-muted/30">
										<AgentCliIcon agent={cli ?? ""} className="size-4" />
									</div>
								) : (
									<div
										className="flex h-7 w-7 shrink-0 items-center justify-center border bg-muted/30"
										style={{
											borderColor: item.skill.color,
											color: item.skill.color,
										}}
									>
										<LucideIcon name={item.skill.icon} className="size-4" />
									</div>
								)}
								<div className="min-w-0 flex-1">
									<div className="truncate font-mono text-sm text-foreground">/{item.name}</div>
									<div className="truncate text-xs text-muted-foreground">{item.description}</div>
								</div>
							</button>
						))}
					</div>
				)}

				<PromptInputBackdrop
					text={value}
					images={images}
					scrollRef={backdropRef}
					className={cn(FIELD_METRICS, "pr-13 md:pr-9")}
				/>

				<textarea
					ref={textareaRef}
					value={value}
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
					disabled={disabled || uploading}
					placeholder={placeholder}
					className={cn(
						"relative flex w-full resize-none rounded-none border border-input bg-transparent pr-13 shadow-xs transition-colors field-sizing-content md:pr-9",
						FIELD_METRICS,
						"placeholder:text-muted-foreground",
						"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-ring",
						"disabled:cursor-not-allowed",
						inputClassName,
					)}
				/>

				{clearArmed && (
					<div className="pointer-events-none absolute right-3 bottom-2 text-xs text-muted-foreground/50 animate-in fade-in-0 duration-150">
						pressione alt + espaço novamente para limpar
					</div>
				)}

				{uploading && (
					<div className="absolute inset-0 z-10 flex items-center justify-center gap-2 border border-input bg-card/70 text-sm text-muted-foreground backdrop-blur-[1px]">
						<Loader2 className="size-4 animate-spin" />
						Colando imagem…
					</div>
				)}

				{value.trim().length > 0 && (
					<Tooltip
						label="Limpar tudo (alt + espaço duas vezes)"
						triggerClassName="absolute top-1 right-1 md:top-2 md:right-2"
					>
						<button
							type="button"
							onClick={clearAll}
							aria-label="Limpar tudo"
							className="flex size-12 items-center justify-center text-muted-foreground/60 transition-colors hover:text-foreground md:size-6"
						>
							<Eraser className="size-4 md:size-3.5" />
						</button>
					</Tooltip>
				)}
			</div>

			<PromptImageChips
				images={images}
				onRemove={(index) => {
					onImagesChange(images.filter((image) => image.index !== index));
					onChange(value.replaceAll(imagePlaceholder(index), "").trim());
				}}
			/>
		</div>
	);
}
