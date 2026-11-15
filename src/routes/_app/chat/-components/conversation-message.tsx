import { Check, Copy, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MarkdownView } from "@/components/markdown-view";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import type { CodexItem } from "@/lib/conversation";
import { conversationUserText } from "@/lib/conversation-presentation";

function AsyncQuestion({
	question,
	onAnswer,
	answered,
}: {
	answered?: boolean;
	question: NonNullable<CodexItem["questions"]>[number];
	onAnswer?: (text: string) => Promise<boolean>;
}) {
	const [answer, setAnswer] = useState("");
	const [pending, setPending] = useState(false);
	const [sent, setSent] = useState(false);
	const [error, setError] = useState(false);
	async function submit(text: string) {
		if (!onAnswer || pending || !text.trim()) {
			return;
		}
		setPending(true);
		setError(false);
		try {
			const accepted = await onAnswer(`> ${question.title}\n\n${text.trim()}`);
			setSent(accepted);
			setError(!accepted);
		} finally {
			setPending(false);
		}
	}
	return (
		<div className="flex min-w-0 flex-col gap-3 border border-border bg-card p-4">
			<Text size="sm" className="break-words font-medium">
				{question.title}
			</Text>
			{!sent && !answered && (
				<>
					<div className="flex flex-wrap gap-2">
						{question.options?.map((option) => (
							<Button
								key={option}
								variant="outline"
								size="sm"
								className="h-auto min-h-11 max-w-full whitespace-normal break-words py-2 text-left"
								disabled={!onAnswer || pending}
								onClick={() => void submit(option)}
							>
								{option}
							</Button>
						))}
					</div>
					{onAnswer && (
						<form
							className="flex items-center gap-2"
							onSubmit={(event) => {
								event.preventDefault();
								void submit(answer);
							}}
						>
							<Input
								aria-label={`Resposta: ${question.title}`}
								value={answer}
								onChange={(event) => setAnswer(event.target.value)}
								disabled={pending}
								placeholder="Escreva sua resposta"
								className="min-w-0 flex-1"
							/>
							<Button
								type="submit"
								variant="outline"
								size="sm"
								disabled={pending || !answer.trim()}
							>
								{pending && <Loader2 className="size-3.5 animate-spin" />}Responder
							</Button>
						</form>
					)}
				</>
			)}
			{(sent || answered) && (
				<Text role="status" size="xs" tone="muted">
					Resposta enviada
				</Text>
			)}
			{error && (
				<Text role="alert" size="xs" tone="destructive">
					Não foi possível enviar. Tente novamente.
				</Text>
			)}
		</div>
	);
}

export function ConversationMessage({
	item,
	final,
	answeredQuestions,
	onAnswer,
}: {
	item: CodexItem;
	final: boolean;
	answeredQuestions?: boolean[];
	onAnswer?: (text: string) => Promise<boolean>;
}) {
	const [copied, setCopied] = useState(false);
	const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(
		() => () => {
			if (copyTimer.current) {
				clearTimeout(copyTimer.current);
			}
		},
		[],
	);
	if (item.type === "userMessage") {
		const text = conversationUserText(item);
		const attachments = (item.content ?? []).filter(
			(part) => typeof part !== "string" && part.type !== "text",
		);
		return (
			<div
				data-item-id={item.id}
				data-item-type={item.type}
				className="ml-auto w-fit min-w-0 max-w-[90%] border border-border bg-secondary/50 px-4 py-3"
			>
				{text && <MarkdownView text={text} className="text-sm" />}
				{attachments.length > 0 && (
					<div className="mt-2 flex flex-wrap gap-2">
						{attachments.map((part, index) => {
							if (typeof part === "string") {
								return null;
							}
							return (
								<Text
									key={index}
									as="span"
									size="xs"
									tone="muted"
									className="border border-border px-2 py-1"
								>
									{part.name ?? part.path?.split("/").at(-1) ?? "Imagem anexada"}
								</Text>
							);
						})}
					</div>
				)}
			</div>
		);
	}
	return (
		<div
			data-item-id={item.id}
			data-item-type={item.type}
			data-phase={item.phase}
			className="group min-w-0"
		>
			{item.text?.trim() && <MarkdownView text={item.text} className="text-sm leading-7" />}
			{item.questions?.map((question, index) => (
				<AsyncQuestion
					key={`${item.id}:${index}`}
					question={question}
					answered={answeredQuestions?.[index]}
					onAnswer={onAnswer}
				/>
			))}
			{final && item.text?.trim() && (
				<Tooltip label="Copiar resposta">
					<Button
						variant="ghost"
						size="icon"
						aria-label="Copiar resposta"
						className="mt-2 size-9 text-muted-foreground"
						onClick={async () => {
							try {
								await navigator.clipboard.writeText(item.text!);
								if (copyTimer.current) {
									clearTimeout(copyTimer.current);
								}
								setCopied(true);
								copyTimer.current = setTimeout(() => setCopied(false), 1500);
							} catch {
								setCopied(false);
							}
						}}
					>
						{copied && <Check className="size-3.5" />}
						{!copied && <Copy className="size-3.5" />}
					</Button>
				</Tooltip>
			)}
		</div>
	);
}
