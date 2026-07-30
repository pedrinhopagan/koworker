import { MessageCircleQuestion, Send } from "lucide-react";
import { useState } from "react";

import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AgentEventPayloadOf } from "@/lib/agent-session";
import { cn } from "@/lib/utils";

export function SessionQuestion({
	payload,
	pending,
	onAnswer,
}: {
	payload: AgentEventPayloadOf<"question">;
	pending: boolean;
	onAnswer: (input: { answers: string[]; freeText?: string }) => void;
}) {
	const [selected, setSelected] = useState<string[]>([]);
	const [freeText, setFreeText] = useState("");
	const answered = !!payload.answers;

	function toggle(label: string) {
		if (!payload.multiSelect) {
			onAnswer({ answers: [label] });
			return;
		}

		setSelected((current) =>
			current.includes(label) ? current.filter((item) => item !== label) : [...current, label],
		);
	}

	return (
		<section
			className={cn(
				"min-w-0 border border-border bg-card p-3 md:p-4",
				!answered && "border-primary shadow-[3px_3px_0_var(--primary)]",
			)}
		>
			<header className="flex flex-wrap items-center gap-2">
				<span
					className={cn(
						"flex size-6 shrink-0 items-center justify-center border border-border bg-muted/40",
						!answered && "border-primary text-primary",
					)}
				>
					<MessageCircleQuestion className="size-3" />
				</span>
				<Text as="span" className="text-[11px] font-bold uppercase tracking-[0.12em]">
					{answered ? "Pergunta respondida" : "O agente perguntou"}
				</Text>
				{payload.multiSelect && !answered && (
					<Text as="span" size="xs" tone="muted">
						pode escolher mais de uma
					</Text>
				)}
			</header>

			<Text className="mt-2 break-words text-[15px] leading-6">{payload.question}</Text>

			{answered ? (
				<Text size="xs" tone="muted" className="mt-3">
					Você respondeu:{" "}
					{[...(payload.answers ?? []), payload.freeText].filter(Boolean).join(", ")}
				</Text>
			) : (
				<div className="mt-3 space-y-2">
					<ul className="grid gap-2">
						{payload.options.map((option) => (
							<li key={option.label}>
								<button
									type="button"
									disabled={pending}
									onClick={() => toggle(option.label)}
									className={cn(
										"w-full cursor-pointer border border-border bg-background px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
										selected.includes(option.label) && "border-primary bg-primary/10",
									)}
								>
									<Text as="span" className="block text-sm font-medium">
										{option.label}
									</Text>
									{option.description && (
										<Text as="span" size="xs" tone="muted" className="mt-0.5 block">
											{option.description}
										</Text>
									)}
								</button>
							</li>
						))}
					</ul>

					<div className="flex items-end gap-2">
						<Input
							value={freeText}
							onChange={(event) => setFreeText(event.target.value)}
							placeholder="Ou responda com suas palavras"
							className="min-w-0 flex-1"
							onKeyDown={(event) => {
								if (event.key === "Enter" && freeText.trim()) {
									onAnswer({ answers: selected, freeText: freeText.trim() });
								}
							}}
						/>
						<Button
							size="icon"
							aria-label="Enviar resposta"
							disabled={pending || (selected.length === 0 && !freeText.trim())}
							onClick={() =>
								onAnswer({
									answers: selected,
									...(freeText.trim() ? { freeText: freeText.trim() } : {}),
								})
							}
						>
							<Send className="size-4" />
						</Button>
					</div>
				</div>
			)}
		</section>
	);
}
