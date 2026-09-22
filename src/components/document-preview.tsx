import { Loader2 } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { PREVIEW_SCROLL_MESSAGE } from "@/lib/file-preview";
import { cn } from "@/lib/utils";

// Cabeçalho que sai de cena enquanto o conteúdo rola: a altura anima até zero em vez de sumir de
// uma vez, para o documento crescer sem pular.
export function ScrollAwayChrome({ hidden, children }: { hidden: boolean; children: ReactNode }) {
	return (
		<div
			className={cn(
				"grid shrink-0 transition-[grid-template-rows] duration-200",
				hidden ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
			)}
		>
			<div className="min-h-0 overflow-hidden">{children}</div>
		</div>
	);
}

export function DocumentPreview({
	name,
	format,
	url,
	revision,
	onScroll,
}: {
	name: string;
	format: "html" | "pdf";
	url: string;
	revision: number;
	onScroll?: (delta: number, top: number) => void;
}) {
	const [loading, setLoading] = useState(true);
	const [failed, setFailed] = useState(false);
	const frame = useRef<HTMLIFrameElement>(null);
	const scrolled = useRef(onScroll);
	scrolled.current = onScroll;

	// O HTML roda em origem isolada; quem conta a rolagem é o script que o preview injeta nele.
	useEffect(() => {
		function receive(event: MessageEvent) {
			const data = event.data as { type?: unknown; delta?: unknown; top?: unknown } | null;
			if (
				event.source === frame.current?.contentWindow &&
				data?.type === PREVIEW_SCROLL_MESSAGE &&
				typeof data.delta === "number" &&
				typeof data.top === "number"
			) {
				scrolled.current?.(data.delta, data.top);
			}
		}

		window.addEventListener("message", receive);
		return () => window.removeEventListener("message", receive);
	}, []);

	return (
		<div className="relative flex h-full min-h-0 flex-col" data-component="document-preview">
			{loading && (
				<Loader2
					className="absolute left-3 top-3 size-4 animate-spin text-muted-foreground"
					aria-label="Carregando documento"
				/>
			)}
			{failed && (
				<span role="alert" className="absolute left-3 top-3 text-sm text-muted-foreground">
					Não foi possível carregar o documento.
				</span>
			)}
			<iframe
				ref={frame}
				key={revision}
				title={name}
				src={`${url}?v=${revision}`}
				sandbox={format === "html" ? "allow-scripts allow-downloads" : undefined}
				referrerPolicy="no-referrer"
				className="min-h-0 w-full flex-1 border-0 bg-background"
				onLoad={() => setLoading(false)}
				onError={() => {
					setLoading(false);
					setFailed(true);
				}}
			/>
		</div>
	);
}
