import { Loader2, Mic, Send } from "lucide-react";
import { useEffect, useState } from "react";

import { PromptField } from "@/components/prompt-bar/prompt-field";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { resolveImagePlaceholders } from "@/lib/build-prompt";
import { clearPromptDraft, readPromptDraft, writePromptDraft } from "@/lib/prompt-draft";
import { AudioRecorder } from "./audio-recorder";

export function ThreadComposer({
	draftKey,
	projectName,
	disabled,
	pending,
	hint,
	placeholder = "Responda ao agente nesta mesma sessão…",
	helperText = "Ctrl+Enter envia · / insere uma skill · cole imagens. O agente mantém o contexto desta conversa.",
	onSubmit,
}: {
	draftKey: string;
	projectName?: string;
	disabled: boolean;
	pending: boolean;
	hint: string;
	placeholder?: string;
	helperText?: string;
	onSubmit: (
		prompt: string,
		inputKind: "text" | "audio_transcript",
	) => boolean | void | Promise<boolean | void>;
}) {
	const [draft, setDraft] = useState(() => readPromptDraft(draftKey));
	const [inputKind, setInputKind] = useState<"text" | "audio_transcript">("text");
	const [dictating, setDictating] = useState(false);

	useEffect(() => {
		const timer = setTimeout(() => writePromptDraft(draftKey, draft), 300);

		return () => clearTimeout(timer);
	}, [draftKey, draft]);

	async function submit() {
		if (!draft.text.trim() || disabled || pending) {
			return;
		}
		const accepted = await onSubmit(
			resolveImagePlaceholders(draft.text.trim(), draft.images),
			inputKind,
		);
		if (accepted === false) {
			return;
		}
		setDraft({ text: "", images: [] });
		clearPromptDraft(draftKey);
		setInputKind("text");
	}

	return (
		<div className="z-20 -mx-4 shrink-0 border-t border-border/70 bg-background/90 px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur-xl">
			<div className="mx-auto w-full max-w-3xl rounded-xl border border-border/70 bg-card p-2 shadow-sm">
				{dictating ? (
					<div className="pb-1">
						<AudioRecorder
							onTranscribed={(value) => {
								setDraft((current) => ({
									...current,
									text: current.text ? `${current.text}\n${value}` : value,
								}));
								setInputKind("audio_transcript");
								setDictating(false);
							}}
						/>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => setDictating(false)}
							className="mt-1"
						>
							Voltar a escrever
						</Button>
					</div>
				) : (
					<div className="flex items-end gap-2">
						<PromptField
							value={draft.text}
							images={draft.images}
							{...(projectName ? { projectName } : {})}
							disabled={disabled}
							placeholder={disabled ? hint : placeholder}
							className="min-w-0 flex-1"
							inputClassName="max-h-[200px] min-h-12"
							menuAbove
							onChange={(value) => {
								setDraft((current) => ({ ...current, text: value }));
								setInputKind("text");
							}}
							onImagesChange={(value) => setDraft((current) => ({ ...current, images: value }))}
							onSubmit={() => void submit()}
						/>
						<Button
							type="button"
							variant="outline"
							size="icon"
							aria-label="Ditar continuação"
							onClick={() => setDictating(true)}
							disabled={disabled || pending}
							className="size-12 shrink-0"
						>
							<Mic className="size-5" />
						</Button>
						<Button
							type="button"
							aria-label="Enviar continuação"
							onClick={() => void submit()}
							disabled={disabled || pending || !draft.text.trim()}
							className="size-12 shrink-0 p-0"
						>
							{pending ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
						</Button>
					</div>
				)}
				<Text size="xs" tone="muted" className="mt-1.5 hidden sm:block">
					{disabled ? hint : helperText}
				</Text>
			</div>
		</div>
	);
}
