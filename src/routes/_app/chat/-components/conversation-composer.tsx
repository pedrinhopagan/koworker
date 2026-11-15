import { ArrowUp, Loader2, SlidersHorizontal, Square } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { z } from "zod";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobileViewport } from "@/hooks/use-is-mobile-viewport";

const draftSchema = z.object({ text: z.string(), clientMessageId: z.string().uuid() });

function readDraft(key: string) {
	try {
		const saved = localStorage.getItem(key);
		if (saved) {
			const result = draftSchema.safeParse(JSON.parse(saved));
			if (result.success) {
				return result.data;
			}
		}
	} catch {}
	return { text: "", clientMessageId: crypto.randomUUID() };
}

export function ConversationComposer({
	draftKey,
	onSend,
	pending,
	disabled,
	busy,
	onInterrupt,
	interrupting,
	controls,
	error,
}: {
	draftKey: string;
	onSend: (input: z.infer<typeof draftSchema>) => Promise<boolean>;
	pending: boolean;
	disabled?: boolean;
	busy?: boolean;
	onInterrupt?: () => void;
	interrupting?: boolean;
	controls?: ReactNode;
	error?: string | null;
}) {
	const [draft, setDraft] = useState(() => readDraft(draftKey));
	const textarea = useRef<HTMLTextAreaElement>(null);
	const submitting = useRef(false);
	const isMobile = useIsMobileViewport();

	useEffect(() => {
		try {
			if (draft.text) {
				localStorage.setItem(draftKey, JSON.stringify(draft));
			} else {
				localStorage.removeItem(draftKey);
			}
		} catch {}
		if (textarea.current) {
			textarea.current.style.height = "auto";
			textarea.current.style.height = `${Math.min(textarea.current.scrollHeight, isMobile ? 112 : 200)}px`;
		}
	}, [draft, draftKey, isMobile]);

	async function handleSubmit() {
		if (!draft.text.trim() || pending || disabled || submitting.current) {
			return;
		}
		const submitted = draft;
		submitting.current = true;
		try {
			if (await onSend(submitted)) {
				setDraft((current) => {
					if (current.text !== submitted.text) {
						return current;
					}
					return { text: "", clientMessageId: crypto.randomUUID() };
				});
			}
		} finally {
			submitting.current = false;
		}
	}

	return (
		<div
			data-component="chat-composer"
			className="mx-auto w-full max-w-3xl shrink-0 px-3 pb-3 sm:px-6 sm:pb-6"
		>
			<form
				className="border border-border bg-card p-3 shadow-xs focus-within:border-ring"
				onSubmit={(event) => {
					event.preventDefault();
					void handleSubmit();
				}}
			>
				<label htmlFor="conversation-message" className="sr-only">
					Mensagem para o Codex
				</label>
				<textarea
					id="conversation-message"
					ref={textarea}
					value={draft.text}
					rows={2}
					maxLength={100_000}
					placeholder={
						busy
							? "Oriente o Codex durante a execução…"
							: "Peça ao Codex para trabalhar no seu projeto…"
					}
					disabled={disabled}
					readOnly={pending}
					onChange={(event) =>
						setDraft({ text: event.target.value, clientMessageId: crypto.randomUUID() })
					}
					onKeyDown={(event) => {
						if (
							event.key === "Enter" &&
							!event.shiftKey &&
							!event.nativeEvent.isComposing &&
							!window.matchMedia("(pointer: coarse)").matches
						) {
							event.preventDefault();
							void handleSubmit();
						}
					}}
					className="min-h-16 w-full resize-none border-0 bg-transparent px-1 py-2 text-base leading-relaxed outline-none placeholder:text-muted-foreground/60 disabled:opacity-50 sm:text-sm"
				/>
				<div className="flex min-w-0 items-end justify-between gap-2">
					{!isMobile && <div className="flex min-w-0 flex-wrap items-center gap-1">{controls}</div>}
					{isMobile && controls && (
						<Popover>
							<PopoverTrigger asChild>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									aria-label="Opções da mensagem"
									className="size-11"
								>
									<SlidersHorizontal className="size-5" />
								</Button>
							</PopoverTrigger>
							<PopoverContent
								side="top"
								align="start"
								className="flex max-h-[var(--radix-popover-content-available-height)] w-64 max-w-[calc(100vw-2rem)] flex-col gap-2 overflow-y-auto p-3"
							>
								<Text size="sm" className="font-medium">
									Opções da mensagem
								</Text>
								{controls}
							</PopoverContent>
						</Popover>
					)}
					<div className="flex shrink-0 items-center gap-2">
						{busy && onInterrupt && (
							<Tooltip label="Interromper execução">
								<Button
									type="button"
									variant="ghost"
									size="icon"
									aria-label="Interromper execução"
									className="size-11"
									disabled={interrupting}
									onClick={onInterrupt}
								>
									{interrupting && <Loader2 className="size-4 animate-spin" />}
									{!interrupting && <Square className="size-4" />}
								</Button>
							</Tooltip>
						)}
						<Tooltip label={busy ? "Enviar orientação" : "Enviar mensagem"}>
							<Button
								type="submit"
								size="icon"
								aria-label={busy ? "Enviar orientação" : "Enviar mensagem"}
								onPointerDown={(event) => event.preventDefault()}
								className="size-11 bg-primary text-primary-foreground hover:bg-primary/90"
								disabled={!draft.text.trim() || pending || disabled}
							>
								{pending && <Loader2 className="size-5 animate-spin" />}
								{!pending && <ArrowUp className="size-5" />}
							</Button>
						</Tooltip>
					</div>
				</div>
			</form>
			{error && (
				<Text role="alert" size="sm" tone="destructive" className="mt-2 break-words">
					{error}
				</Text>
			)}
			<Text size="xs" tone="faint" className="chat-composer-hint mt-2 text-center">
				{busy && "A orientação entra na execução atual."}
				{!busy && "O Codex trabalha nos arquivos do projeto selecionado."}
			</Text>
		</div>
	);
}
