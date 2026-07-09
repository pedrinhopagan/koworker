import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ImageOff, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { Tooltip } from "@/components/ui/tooltip";
import { IMAGE_MIME_BY_EXT } from "@/constants/koworker";
import { useObjectUrl } from "@/hooks/use-object-url";
import { imagePlaceholder } from "@/lib/build-prompt";
import { isTauri, readClipboardImageFile } from "@/lib/tauri";
import { type PromptImage, usePromptBarStore } from "@/stores/prompt-bar";

const ACCEPTED_IMAGE_MIMES = new Set(Object.values(IMAGE_MIME_BY_EXT));

// Cola de imagem no textarea do prompt: sobe cada imagem pro `.koworker/medias/` do projeto da rota
// e insere `[Imagem N]` no ponto do caret — o marcador que a composição do prompt troca pelo path.
// Colar sem projeto resolvido não tem onde gravar, então vira toast e a cola é ignorada.
export function usePromptImagePaste(params: {
	projectName?: string;
	textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
	const projectsQuery = useQuery(orpc.projects.list.queryOptions());
	const queryClient = useQueryClient();
	const [uploading, setUploading] = useState(false);

	function insertAtCaret(snippet: string) {
		const node = params.textareaRef.current;
		const { text, setText } = usePromptBarStore.getState();
		const start = node?.selectionStart ?? text.length;
		const end = node?.selectionEnd ?? start;

		setText(text.slice(0, start) + snippet + text.slice(end));

		const caret = start + snippet.length;
		requestAnimationFrame(() => {
			node?.focus();
			node?.setSelectionRange(caret, caret);
		});
	}

	async function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
		// No navegador a imagem colada chega nos `items` via `getAsFile()` (síncrono de propósito: depois
		// do `await` o `clipboardData` já foi neutralizado).
		const files: File[] = [];
		for (const item of event.clipboardData.items) {
			if (item.kind !== "file" || !ACCEPTED_IMAGE_MIMES.has(item.type)) continue;
			const file = item.getAsFile();
			if (file) files.push(file);
		}

		if (files.length === 0) {
			// Sem imagem nos items: se há texto, é uma cola normal — deixa seguir. Sem texto e dentro do
			// Tauri, o print colado ficou só no clipboard do OS (WebKitGTK não o entrega ao evento web):
			// barra o paste e lê de lá.
			if (event.clipboardData.getData("text/plain") || !isTauri()) return;
			event.preventDefault();
			const image = await readClipboardImageFile();
			if (!image) return;
			files.push(image);
		} else {
			event.preventDefault();
		}

		const project = projectsQuery.data?.find((entry) => entry.name === params.projectName);
		if (!project) {
			toast.error("Selecione um projeto para colar imagens");
			return;
		}

		setUploading(true);
		try {
			for (const file of files) {
				const saved = await orpc.media.uploadFile.call({ projectId: project.id, file });
				const index = usePromptBarStore
					.getState()
					.addImage({ projectId: project.id, name: saved.name });
				insertAtCaret(imagePlaceholder(index));
			}
			queryClient.invalidateQueries({
				predicate: (query) => Array.isArray(query.queryKey[0]) && query.queryKey[0][0] === "media",
			});
		} catch (err: any) {
			toast.error(err?.message ?? "Não foi possível salvar a imagem");
		} finally {
			setUploading(false);
		}
	}

	return { handlePaste, uploading };
}

// Espelho atrás do textarea: repinta o mesmo texto com a mesma métrica, mas troca cada `[Imagem N]`
// por um chip. O texto real e editável fica no textarea por cima — aqui só o fundo dos chips é
// visível (o resto é transparente), então um eventual 1px de desalinhamento desloca o realce sem
// nunca sumir com o texto. `scrollRef` deixa o pai sincronizar a rolagem com a do textarea.
export function PromptInputBackdrop({
	text,
	scrollRef,
}: {
	text: string;
	scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
	const images = usePromptBarStore((s) => s.images);
	const tokens = new Set(images.map((image) => imagePlaceholder(image.index)));

	return (
		<div
			ref={scrollRef}
			aria-hidden
			className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words rounded-none border border-transparent bg-card px-3 py-2 pr-9 text-base text-transparent"
		>
			{renderPromptChips(text, tokens)}
		</div>
	);
}

// Fatia o texto nos marcadores conhecidos (só os que têm imagem no store): trechos comuns viram
// string crua, cada `[Imagem N]` vira o chip. `box-decoration-clone` mantém o arredondado se o token
// quebrar de linha; `py` pinta o fundo sem mexer na métrica (padding vertical de inline não desloca
// a linha), preservando o alinhamento com o textarea.
function renderPromptChips(text: string, tokens: Set<string>): React.ReactNode {
	if (tokens.size === 0) return text;

	const nodes: React.ReactNode[] = [];
	const pattern = /\[Imagem \d+\]/g;
	let last = 0;
	let match: RegExpExecArray | null;

	while ((match = pattern.exec(text)) !== null) {
		if (!tokens.has(match[0])) continue;
		if (match.index > last) nodes.push(text.slice(last, match.index));
		nodes.push(
			<span
				key={match.index}
				className="rounded-[3px] py-0.5 box-decoration-clone bg-[color-mix(in_oklch,var(--project-accent,var(--primary))_20%,transparent)]"
			>
				{match[0]}
			</span>,
		);
		last = pattern.lastIndex;
	}
	nodes.push(text.slice(last));

	return nodes;
}

// Faixa de chips das imagens anexadas ao rascunho, logo abaixo do textarea: miniatura + `Imagem N`
// + soltar. Clicar na miniatura abre a imagem na /media; soltar só desanexa (o arquivo fica lá). O
// loading da gravação em si mora no overlay do input, não aqui.
export function PromptImageChips() {
	const images = usePromptBarStore((s) => s.images);

	if (images.length === 0) return null;

	return (
		<div className="mt-2 flex flex-wrap items-center gap-1.5">
			{images.map((image) => (
				<PromptImageChip key={image.index} image={image} />
			))}
		</div>
	);
}

function PromptImageChip({ image }: { image: PromptImage }) {
	const removeImage = usePromptBarStore((s) => s.removeImage);

	const fileQuery = useQuery(
		orpc.media.readFile.queryOptions({
			input: { projectId: image.projectId, name: image.name },
		}),
	);
	const url = useObjectUrl(fileQuery.data);

	return (
		<span className="flex h-8 items-center gap-1.5 border border-border bg-card pl-1 pr-1">
			<Tooltip label={image.name}>
				<Link
					to="/media/$fileName"
					params={{ fileName: image.name }}
					search={{ projectId: image.projectId }}
					className="flex size-6 shrink-0 items-center justify-center overflow-hidden bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
				>
					{url ? (
						<img src={url} alt={image.name} className="size-full object-cover" />
					) : (
						<ImageOff className="size-3.5 text-muted-foreground/60" />
					)}
				</Link>
			</Tooltip>
			<span className="text-xs text-muted-foreground">{imagePlaceholder(image.index)}</span>
			<Tooltip label="Remover do prompt">
				<button
					type="button"
					onClick={() => removeImage(image.index)}
					aria-label={`Remover ${imagePlaceholder(image.index)} do prompt`}
					className="flex size-5 items-center justify-center text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
				>
					<X className="size-3" />
				</button>
			</Tooltip>
		</span>
	);
}
