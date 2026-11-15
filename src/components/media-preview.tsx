import { Download, ExternalLink, Loader2, Music2 } from "lucide-react";
import { useState, type SyntheticEvent } from "react";

import type { RouterOutputs } from "@/client";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format-bytes";
import { fileHref, openLinkTarget } from "@/lib/link-navigation";

type MediaFile = Extract<RouterOutputs["system"]["readFile"], { kind: "media" }>;

export function MediaPreview({ file }: { file: MediaFile }) {
	const [loading, setLoading] = useState(true);
	const [failed, setFailed] = useState(false);
	const [details, setDetails] = useState<string | null>(null);

	function handleMetadata(event: SyntheticEvent<HTMLMediaElement>) {
		const media = event.currentTarget;
		if (media instanceof HTMLVideoElement && (!media.videoWidth || !media.videoHeight)) {
			media.pause();
			handleError();
			return;
		}

		const duration = media.duration;
		const values: string[] = [];
		if (Number.isFinite(duration)) {
			values.push(
				`${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, "0")}`,
			);
		}
		if (media instanceof HTMLVideoElement) {
			values.push(`${media.videoWidth} × ${media.videoHeight}`);
		}

		setDetails(values.join(" · "));
		setLoading(false);
	}

	function handleError() {
		setFailed(true);
		setLoading(false);
	}

	return (
		<div
			data-component="media-preview"
			className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:p-6"
		>
			{file.format === "video" && (
				<video
					src={file.url}
					controls
					playsInline
					preload="metadata"
					aria-label={file.name}
					className="max-h-[calc(100dvh-14rem)] w-full bg-muted object-contain focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
					onLoadedMetadata={handleMetadata}
					onError={handleError}
				/>
			)}
			{file.format === "audio" && (
				<div className="flex min-h-64 flex-col items-center justify-center gap-6 border border-border bg-card p-6">
					<Music2 className="size-12 text-muted-foreground" />
					<Title as="span" size="sm" className="max-w-full break-all text-center">
						{file.name}
					</Title>
					<audio
						src={file.url}
						controls
						preload="metadata"
						aria-label={file.name}
						className="w-full max-w-xl"
						onLoadedMetadata={handleMetadata}
						onError={handleError}
					/>
				</div>
			)}
			{loading && !failed && (
				<div role="status" className="flex items-center gap-2 text-muted-foreground">
					<Loader2 className="size-4 animate-spin" />
					<Text size="sm" tone="muted">
						Carregando mídia...
					</Text>
				</div>
			)}
			{failed && (
				<Text as="div" role="alert" size="sm" tone="muted">
					Não foi possível reproduzir este arquivo. Baixe ou abra no sistema para usar outro player.
				</Text>
			)}
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Text size="xs" tone="muted" className="tabular-nums">
					{details && `${details} · `}
					{formatBytes(file.size)}
				</Text>
				<div className="flex flex-wrap items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						className="h-12 md:h-8"
						onClick={() => void openLinkTarget(fileHref(file.path), undefined, undefined, true)}
					>
						<ExternalLink className="size-4" />
						Abrir no sistema
					</Button>
					<Button variant="outline" size="sm" className="h-12 md:h-8" asChild>
						<a href={`${file.url}?download`} download={file.name}>
							<Download className="size-4" />
							Baixar arquivo
						</a>
					</Button>
				</div>
			</div>
		</div>
	);
}
