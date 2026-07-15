import { useMutation } from "@tanstack/react-query";
import { CircleHelp, CircleStop, Loader2, Mic, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/typography";
import { GroqSetupGuide } from "./groq-setup-guide";

const AUDIO_TYPES = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"];

export function AudioRecorder({ onTranscribed }: { onTranscribed: (text: string) => void }) {
	const recorderRef = useRef<MediaRecorder | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const mountedRef = useRef(true);
	const chunksRef = useRef<Blob[]>([]);
	const [recording, setRecording] = useState(false);
	const [audio, setAudio] = useState<{ blob: Blob; url: string } | null>(null);
	const [guideOpen, setGuideOpen] = useState(false);
	const supported = typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

	const transcription = useMutation({
		...orpc.prompt.transcribe.mutationOptions(),
		onSuccess: ({ text }) => onTranscribed(text),
		onError: (error: Error) => {
			toast.error(error.message);
			if (error.message.includes("GROQ_API_KEY")) {
				setGuideOpen(true);
			}
		},
	});

	useEffect(() => {
		return () => {
			mountedRef.current = false;
			const recorder = recorderRef.current;
			if (recorder && recorder.state !== "inactive") {
				recorder.onstop = null;
				recorder.stop();
			}
			streamRef.current?.getTracks().forEach((track) => track.stop());
		};
	}, []);

	useEffect(() => {
		return () => {
			if (audio) {
				URL.revokeObjectURL(audio.url);
			}
		};
	}, [audio]);

	async function handleRecord() {
		if (!supported) {
			toast.error("Gravação de áudio não está disponível neste navegador");
			return;
		}

		const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
		if (!stream) {
			toast.error("Não foi possível acessar o microfone");
			return;
		}
		if (!mountedRef.current) {
			stream.getTracks().forEach((track) => track.stop());
			return;
		}

		const mimeType = AUDIO_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
		const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
		streamRef.current = stream;
		chunksRef.current = [];
		recorder.ondataavailable = (event) => {
			if (event.data.size > 0) {
				chunksRef.current.push(event.data);
			}
		};
		recorder.onstop = () => {
			const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
			setAudio((current) => {
				if (current) {
					URL.revokeObjectURL(current.url);
				}
				return { blob, url: URL.createObjectURL(blob) };
			});
			stream.getTracks().forEach((track) => track.stop());
			streamRef.current = null;
		};
		recorder.start();
		recorderRef.current = recorder;
		setRecording(true);
	}

	function handleStop() {
		recorderRef.current?.stop();
		recorderRef.current = null;
		setRecording(false);
	}

	function handleReset() {
		setAudio((current) => {
			if (current) {
				URL.revokeObjectURL(current.url);
			}
			return null;
		});
	}

	function handleTranscribe() {
		if (!audio) {
			return;
		}
		const extension = audio.blob.type.includes("mp4")
			? "m4a"
			: audio.blob.type.includes("ogg")
				? "ogg"
				: "webm";
		transcription.mutate({
			file: new File([audio.blob], `gravacao.${extension}`, { type: audio.blob.type }),
		});
	}

	return (
		<div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
			{!recording && !audio && (
				<Button type="button" variant="outline" size="sm" onClick={() => void handleRecord()}>
					<Mic className="size-4" />
					Gravar instrução
				</Button>
			)}
			{recording && (
				<Button type="button" variant="destructive" size="sm" onClick={handleStop}>
					<CircleStop className="size-4" />
					Parar gravação
				</Button>
			)}
			{audio && (
				<>
					<audio controls src={audio.url} className="h-8 max-w-full flex-1" />
					<Button
						type="button"
						variant="outline"
						size="icon"
						onClick={handleReset}
						aria-label="Refazer gravação"
					>
						<RotateCcw className="size-4" />
					</Button>
					<Button
						type="button"
						size="sm"
						onClick={handleTranscribe}
						disabled={transcription.isPending}
					>
						{transcription.isPending ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Play className="size-4" />
						)}
						{transcription.isPending ? "Transcrevendo" : "Usar transcrição"}
					</Button>
				</>
			)}
			{recording && (
				<Text size="xs" tone="muted">
					O áudio só é enviado quando você pedir a transcrição.
				</Text>
			)}
			<Button
				type="button"
				variant="ghost"
				size="sm"
				onClick={() => setGuideOpen(true)}
				className="ml-auto"
			>
				<CircleHelp className="size-4" />
				Como ativar a Groq
			</Button>
			<GroqSetupGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
		</div>
	);
}
