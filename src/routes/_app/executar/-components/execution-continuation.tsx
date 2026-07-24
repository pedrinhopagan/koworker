import { Loader2, Send, Waypoints } from "lucide-react";
import { useEffect, useState } from "react";

import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AudioRecorder } from "./audio-recorder";

export function ExecutionContinuation({
	cli,
	model,
	pending,
	draftKey,
	onSubmit,
}: {
	cli: string;
	model?: string;
	pending: boolean;
	draftKey: string;
	onSubmit: (prompt: string, inputKind: "text" | "audio_transcript") => void;
}) {
	const [text, setText] = useState(() => localStorage.getItem(draftKey) ?? "");
	const [inputKind, setInputKind] = useState<"text" | "audio_transcript">("text");

	useEffect(() => {
		const timer = setTimeout(() => localStorage.setItem(draftKey, text), 300);
		return () => clearTimeout(timer);
	}, [draftKey, text]);

	function submit() {
		if (!text.trim()) {
			return;
		}
		onSubmit(text.trim(), inputKind);
	}

	return (
		<section className="border border-border bg-card p-4 shadow-[3px_3px_0_var(--border)] md:p-5">
			<div className="mb-4 flex items-start gap-3">
				<span className="flex size-9 shrink-0 items-center justify-center border border-border bg-muted/40">
					<Waypoints className="size-4" />
				</span>
				<div>
					<Title as="h2" size="sm">
						Continuar esta sessão
					</Title>
					<Text size="xs" tone="muted">
						O novo turno mantém o contexto em {cli === "codex" ? "Codex" : "Claude"}
						{model && ` · ${model}`} e ganha seu próprio resultado.
					</Text>
				</div>
			</div>
			<Textarea
				value={text}
				onChange={(event) => {
					setText(event.target.value);
					setInputKind("text");
				}}
				placeholder="O que o agente deve fazer agora?"
				className="min-h-32 resize-y text-base leading-7"
			/>
			<AudioRecorder
				onTranscribed={(value) => {
					setText(value);
					setInputKind("audio_transcript");
				}}
			/>
			<div className="mt-4 flex justify-end border-t border-border pt-4">
				<Button onClick={submit} disabled={!text.trim() || pending} className="w-full sm:w-auto">
					{pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
					{pending ? "Continuando" : "Executar próximo turno"}
				</Button>
			</div>
		</section>
	);
}
