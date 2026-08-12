import { Cpu, Loader2, Mic, Send } from "lucide-react";
import { useEffect, useState } from "react";

import { PromptField } from "@/components/prompt-bar/prompt-field";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import { CODEX_MODEL_OPTIONS, INVOKE_INHERIT, INVOKE_MODEL_OPTIONS } from "@/constants/invoke";
import { resolveImagePlaceholders } from "@/lib/build-prompt";
import { clearPromptDraft, readPromptDraft, writePromptDraft } from "@/lib/prompt-draft";
import { AudioRecorder } from "./audio-recorder";

export function ThreadComposer({
	draftKey,
	projectName,
	cli,
	disabled,
	pending,
	hint,
	placeholder = "Responda ao agente nesta mesma sessão…",
	helperText = "Ctrl+Enter envia · / insere uma skill · cole imagens. O agente mantém o contexto desta conversa.",
	onSubmit,
	onCommand,
}: {
	draftKey: string;
	projectName?: string;
	cli?: string;
	disabled: boolean;
	pending: boolean;
	hint: string;
	placeholder?: string;
	helperText?: string;
	onSubmit: (
		prompt: string,
		inputKind: "text" | "audio_transcript",
	) => boolean | void | Promise<boolean | void>;
	onCommand?: (command: string) => boolean | void | Promise<boolean | void>;
}) {
	const [draft, setDraft] = useState(() => readPromptDraft(draftKey));
	const [inputKind, setInputKind] = useState<"text" | "audio_transcript">("text");
	const [dictating, setDictating] = useState(false);
	const [selectedModel, setSelectedModel] = useState<string>();
	const [switchingModel, setSwitchingModel] = useState(false);
	const modelItems = (cli === "codex" ? CODEX_MODEL_OPTIONS : INVOKE_MODEL_OPTIONS)
		.filter((option) => option.value !== INVOKE_INHERIT)
		.map((option) => ({ id: option.value, label: option.label, hint: option.hint }));
	const selectedModelItem = modelItems.find((item) => item.id === selectedModel);

	useEffect(() => {
		const timer = setTimeout(() => writePromptDraft(draftKey, draft), 300);

		return () => clearTimeout(timer);
	}, [draftKey, draft]);

	// O texto pode chegar por fora do rascunho: o menu de barra aplica o comando e despacha no mesmo
	// gesto, antes de o estado do campo ter voltado do React.
	async function submit(override?: string) {
		const text = (override ?? draft.text).trim();
		if (!text || disabled || pending) {
			return;
		}
		const accepted = await onSubmit(resolveImagePlaceholders(text, draft.images), inputKind);
		if (accepted === false) {
			return;
		}
		setDraft({ text: "", images: [] });
		clearPromptDraft(draftKey);
		setInputKind("text");
	}

	async function switchModel(value: string) {
		if (!onCommand || disabled || pending || switchingModel) {
			return;
		}

		setSwitchingModel(true);
		try {
			const accepted = await onCommand(`/model ${value}`);
			if (accepted !== false) {
				setSelectedModel(value);
			}
		} finally {
			setSwitchingModel(false);
		}
	}

	return (
		<div className="z-20 -mx-4 shrink-0 border-t border-border/70 bg-background/90 px-4 pt-2 pb-2 backdrop-blur-xl">
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
					<div>
						<PromptField
							value={draft.text}
							images={draft.images}
							{...(projectName ? { projectName } : {})}
							{...(cli ? { cli } : {})}
							disabled={disabled}
							placeholder={disabled ? hint : placeholder}
							className="min-w-0 flex-1"
							inputClassName="max-h-[200px] min-h-12"
							menuAbove
							menuAboveOnMobile
							quickMenu
							onChange={(value) => {
								setDraft((current) => ({ ...current, text: value }));
								setInputKind("text");
							}}
							onImagesChange={(value) => setDraft((current) => ({ ...current, images: value }))}
							onSubmit={(text) => void submit(text)}
							toolbar={
								<>
									{onCommand && modelItems.length > 0 && (
										<CustomSelect
											items={modelItems}
											value={selectedModel}
											disabled={disabled || pending || switchingModel}
											fitContent
											ariaLabel="Selecionar modelo da sessão"
											label="Modelo da sessão"
											placeholder="Modelo"
											triggerClassName="h-10 max-w-32 px-2 sm:max-w-44"
											onValueChange={(value) => void switchModel(value)}
											renderTrigger={() => (
												<>
													{switchingModel ? (
														<Loader2 className="size-4 shrink-0 animate-spin" />
													) : (
														<Cpu className="size-4 shrink-0" />
													)}
													<span className="truncate">{selectedModelItem?.label ?? "Modelo"}</span>
												</>
											)}
											renderItem={(item) => (
												<div className="min-w-0">
													<div className="truncate font-semibold">{item.label}</div>
													<div className="truncate text-xs text-muted-foreground">{item.hint}</div>
												</div>
											)}
										/>
									)}
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
								</>
							}
						/>
					</div>
				)}
				<Text size="xs" tone="muted" className="mt-1.5 hidden sm:block">
					{disabled ? hint : helperText}
				</Text>
			</div>
		</div>
	);
}
