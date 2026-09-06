import { Command, Loader2, Mic, Send } from "lucide-react";
import { type ComponentProps, type ReactNode, useEffect, useRef, useState } from "react";

import { PromptField } from "@/components/prompt-bar/prompt-field";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { resolveImagePlaceholders } from "@/lib/build-prompt";
import { clearPromptDraft, readPromptDraft, writePromptDraft } from "@/lib/prompt-draft";
import { AudioRecorder } from "./audio-recorder";

export function ThreadComposer(props: ComponentProps<typeof ThreadComposerContent>) {
	return <ThreadComposerContent key={props.draftKey} {...props} />;
}

function ThreadComposerContent({
	draftKey,
	projectName,
	cli,
	accessory,
	disabled,
	pending,
	hint,
	disabledHintInline = false,
	placeholder = "Responda ao agente nesta mesma sessão…",
	helperText = "Ctrl+Enter envia · / insere uma skill · cole imagens. O agente mantém o contexto desta conversa.",
	onSubmit,
}: {
	draftKey: string;
	projectName?: string;
	cli?: string;
	// Controle extra na barra, entre o menu de skills e o microfone: é onde a conversa põe o
	// seletor de modelo.
	accessory?: ReactNode;
	disabled: boolean;
	pending: boolean;
	hint: string;
	disabledHintInline?: boolean;
	placeholder?: string;
	helperText?: string;
	onSubmit: (
		prompt: string,
		inputKind: "text" | "audio_transcript",
	) => boolean | void | Promise<boolean | void>;
}) {
	const [draft, setDraft] = useState(() => readPromptDraft(draftKey));
	const latestDraft = useRef(draft);
	latestDraft.current = draft;
	const submitting = useRef(false);
	const [inputKind, setInputKind] = useState<"text" | "audio_transcript">("text");
	const [dictating, setDictating] = useState(false);

	useEffect(() => {
		if (draft.text || draft.images.length) {
			writePromptDraft(draftKey, draft);
		} else {
			clearPromptDraft(draftKey);
		}
	}, [draftKey, draft]);

	// O texto pode chegar por fora do rascunho: o menu de barra aplica o comando e despacha no mesmo
	// gesto, antes de o estado do campo ter voltado do React.
	async function submit(override?: string) {
		const text = (override ?? draft.text).trim();
		if (!text || disabled || pending || submitting.current) {
			return;
		}
		submitting.current = true;
		try {
			const submitted = resolveImagePlaceholders(text, draft.images);
			const accepted = await onSubmit(submitted, inputKind);
			if (
				accepted === false ||
				resolveImagePlaceholders(latestDraft.current.text.trim(), latestDraft.current.images) !==
					submitted
			) {
				return;
			}
			setDraft({ text: "", images: [] });
			clearPromptDraft(draftKey);
			setInputKind("text");
		} finally {
			submitting.current = false;
		}
	}

	return (
		<div
			data-component="thread-composer"
			className="z-20 shrink-0 border-t border-border bg-background py-2"
		>
			<div className="mx-auto w-full max-w-3xl border border-border bg-card p-2 shadow-sm">
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
					<div>
						<PromptField
							value={draft.text}
							images={draft.images}
							{...(projectName ? { projectName } : {})}
							{...(cli ? { cli } : {})}
							disabled={disabled}
							placeholder={disabled ? hint : placeholder}
							className="min-w-0 flex-1"
							inputClassName="max-h-[min(160px,25dvh)] min-h-12 max-md:text-[16px]"
							menuAbove
							menuAboveOnMobile
							onChange={(value) => {
								setDraft((current) => ({ ...current, text: value }));
								setInputKind("text");
							}}
							onImagesChange={(value) => setDraft((current) => ({ ...current, images: value }))}
							onSubmit={(text) => void submit(text)}
							toolbar={({ openSlashMenu }) => (
								<div className="flex w-full min-w-0 items-center gap-2">
									{disabled && disabledHintInline && (
										<Text size="xs" tone="muted" className="mr-auto truncate">
											{hint}
										</Text>
									)}
									<Button
										type="button"
										variant="outline"
										size="icon"
										aria-label="Abrir skills e comandos"
										onClick={openSlashMenu}
										disabled={disabled || pending}
										className="size-10 shrink-0"
									>
										<Command className="size-4" />
									</Button>
									{accessory}
									<Button
										type="button"
										variant="outline"
										size="icon"
										aria-label="Ditar continuação"
										onClick={() => setDictating(true)}
										disabled={disabled || pending}
										className="size-10 shrink-0"
									>
										<Mic className="size-4" />
									</Button>
									<Button
										type="button"
										aria-label="Enviar continuação"
										data-slot="send"
										onClick={() => void submit()}
										disabled={disabled || pending || !draft.text.trim()}
										className="size-10 shrink-0 p-0"
									>
										{pending ? (
											<Loader2 className="size-4 animate-spin" />
										) : (
											<Send className="size-4" />
										)}
									</Button>
								</div>
							)}
						/>
					</div>
				)}
				{(!disabled || !disabledHintInline) && (
					<Text size="xs" tone="muted" className="mt-1.5 hidden sm:block">
						{disabled ? hint : helperText}
					</Text>
				)}
			</div>
		</div>
	);
}
