import { ArrowUp, Loader2 } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

type TaskQuickfixProps = {
	disabled?: boolean;
};

export function TaskQuickfix({ disabled }: TaskQuickfixProps) {
	const [input, setInput] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	function handleSubmit() {
		if (!input.trim() || disabled) return;
		setIsSubmitting(true);
		console.log("Quickfix:", input);
		setTimeout(() => {
			setIsSubmitting(false);
			setInput("");
		}, 1000);
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	}

	return (
		<div className="flex gap-2 animate-slide-up-fade">
			<input
				type="text"
				value={input}
				onChange={(e) => setInput(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder="Quickfix: Descreva uma correção rápida..."
				disabled={disabled || isSubmitting}
				className={cn(
					"flex-1 px-4 py-2 bg-background border border-border",
					"text-foreground text-sm",
					"focus:border-accent focus:outline-none transition-all duration-200",
					"disabled:opacity-50 hover:border-muted-foreground/50",
				)}
			/>
			<button
				type="button"
				onClick={handleSubmit}
				disabled={!input.trim() || disabled || isSubmitting}
				className={cn(
					"px-4 py-2 bg-accent text-accent-foreground font-medium text-sm",
					"hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed",
					"transition-all duration-200 flex items-center gap-2",
					"hover:translate-y-[-1px] active:scale-[0.98]",
				)}
			>
				{isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} />}
				Fix
			</button>
		</div>
	);
}
