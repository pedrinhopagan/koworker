import { Copy } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useSkillsQuery } from "@/hooks/use-skills";
import { LucideIcon } from "@/lib/lucide-icon";
import { cn } from "@/lib/utils";
import type { TaskSkill } from "@/types/skills";

type SlashTrigger = { triggerPos: number; query: string };

// O menu de skills só abre quando o "/" está no início do texto ou logo após um
// espaço/quebra de linha — assim caminhos e URLs com "/" no meio de palavra não disparam.
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

type PromptInputProps = {
	value: string;
	onChange: (value: string) => void;
	onSend: () => void;
	projectName?: string;
};

export type PromptInputHandle = {
	mention: (text: string) => void;
};

export const PromptInput = forwardRef<PromptInputHandle, PromptInputProps>(function PromptInput(
	{ value, onChange, onSend, projectName },
	ref,
) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const { taskSkills } = useSkillsQuery(projectName);

	const [trigger, setTrigger] = useState<SlashTrigger | null>(null);
	const [activeIndex, setActiveIndex] = useState(0);

	const matches = useMemo(
		() => (trigger ? filterSkills(taskSkills, trigger.query) : []),
		[trigger, taskSkills],
	);

	const menuOpen = trigger !== null && matches.length > 0;

	useImperativeHandle(ref, () => ({
		mention(text: string) {
			const trimmed = text.trim();
			if (!trimmed) return;
			const node = textareaRef.current;
			const caret = node?.selectionStart ?? value.length;
			const prefix = value.slice(0, caret);
			const suffix = value.slice(caret);
			const needsBreakBefore = prefix.length > 0 && !prefix.endsWith("\n");
			const insertion = `${needsBreakBefore ? "\n" : ""}${trimmed}\n`;
			const next = prefix + insertion + suffix;
			const nextCaret = (prefix + insertion).length;
			onChange(next);
			requestAnimationFrame(() => {
				const el = textareaRef.current;
				if (!el) return;
				el.setSelectionRange(nextCaret, nextCaret);
			});
		},
	}));

	useEffect(() => {
		setActiveIndex(0);
	}, [trigger?.query]);

	function syncTrigger(text: string, caret: number) {
		setTrigger(detectSlashTrigger(text, caret));
	}

	function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
		const next = event.target.value;
		onChange(next);
		syncTrigger(next, event.target.selectionStart);
	}

	function applySkill(skill: TaskSkill) {
		if (!trigger) return;

		const caret = textareaRef.current?.selectionStart ?? value.length;
		const insertion = `/${skill.slug} `;
		const next = value.slice(0, trigger.triggerPos) + insertion + value.slice(caret);
		const nextCaret = trigger.triggerPos + insertion.length;

		onChange(next);
		setTrigger(null);

		requestAnimationFrame(() => {
			const node = textareaRef.current;
			if (!node) return;
			node.focus();
			node.setSelectionRange(nextCaret, nextCaret);
		});
	}

	function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
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
	}

	return (
		<footer className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 py-4 xl:max-w-4xl">
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

				<textarea
					ref={textareaRef}
					value={value}
					onChange={handleChange}
					onKeyDown={handleKeyDown}
					onSelect={(event) =>
						syncTrigger(event.currentTarget.value, event.currentTarget.selectionStart)
					}
					placeholder="Instrução opcional para o agente — digite / para inserir uma skill"
					className={cn(
						"flex max-h-64 min-h-24 w-full resize-none rounded-none border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-colors field-sizing-content",
						"placeholder:text-muted-foreground",
						"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-ring",
					)}
				/>
			</div>

			<Button onClick={onSend} className="self-end">
				<Copy size={14} />
				Copiar prompt
			</Button>
		</footer>
	);
});
