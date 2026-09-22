import { useQuery } from "@tanstack/react-query";
import { createLazyFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import {
	ArrowLeft,
	ExternalLink,
	File,
	FileX,
	Link2,
	Loader2,
	RotateCw,
	Share2,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { CodeFileView } from "@/components/code-file-view";
import { DocumentPreview, ScrollAwayChrome } from "@/components/document-preview";
import { LinkCwdProvider } from "@/components/link-cwd";
import { MarkdownView } from "@/components/markdown-view";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { Tooltip } from "@/components/ui/tooltip";
import { useIsMobileViewport } from "@/hooks/use-is-mobile-viewport";
import { copyToClipboard } from "@/lib/build-prompt";
import { copyFileToClipboard, isDesktop } from "@/lib/desktop";
import { fileHref, openLinkTarget } from "@/lib/link-navigation";
import { errorMessage } from "@/lib/orpc-errors";

export const Route = createLazyFileRoute("/_app/arquivo/")({
	component: FileViewerPage,
});

const MARKDOWN_FILE = /\.(md|mdx|markdown)$/i;
// Trocar a altura do cabeçalho rola o conteúdo sozinho no fim do documento; nesse respiro a rolagem
// não decide nada, senão o cabeçalho piscava entre os dois estados.
const CHROME_SETTLE_MS = 350;
const CHROME_REVEAL_DELTA = 8;

function nextChromeHidden(hidden: boolean, delta: number, top: number) {
	if (top <= 0) {
		return false;
	}
	if (delta > 0) {
		return true;
	}

	return delta < -CHROME_REVEAL_DELTA ? false : hidden;
}

function FileViewerPage() {
	const { path, line } = Route.useSearch();
	const router = useRouter();
	const navigate = useNavigate();
	const query = useQuery({
		...orpc.system.readFile.queryOptions({ input: { path } }),
		retry: false,
		refetchOnWindowFocus: false,
	});
	const file = query.data ?? null;
	const isMobile = useIsMobileViewport();
	const [chromeHidden, setChromeHidden] = useState(false);
	const [documentRevision, setDocumentRevision] = useState(0);
	const chrome = useRef({ hidden: false, settleUntil: 0, top: 0 });
	const name = file?.name ?? path.replace(/\/+$/, "").split("/").at(-1) ?? path;
	const dir = file?.dir ?? path.slice(0, Math.max(0, path.length - name.length - 1));

	function back() {
		if (router.history.canGoBack()) {
			router.history.back();
			return;
		}
		void navigate({ to: "/shells", search: {} });
	}

	// No celular o conteúdo ganha a tela: rolar para baixo recolhe o cabeçalho, para cima devolve.
	function handleScroll(delta: number, top: number) {
		const state = chrome.current;
		if (!isMobile || performance.now() < state.settleUntil) {
			return;
		}
		const hidden = nextChromeHidden(state.hidden, delta, top);
		if (hidden !== state.hidden) {
			state.hidden = hidden;
			state.settleUntil = performance.now() + CHROME_SETTLE_MS;
			setChromeHidden(hidden);
		}
	}

	async function copyPath() {
		if (await copyToClipboard(file?.path ?? path)) {
			toast.success("Caminho copiado");
		}
	}

	async function copyFile() {
		if (!file) {
			return;
		}

		try {
			await copyFileToClipboard(file.path);
			toast.success("Arquivo copiado");
		} catch (error) {
			toast.error(errorMessage(error, "Não foi possível copiar o arquivo"));
		}
	}

	async function reloadDocument() {
		await query.refetch();
		setDocumentRevision((revision) => revision + 1);
	}

	return (
		<div data-component="file-viewer" className="flex h-full min-h-0 flex-1 flex-col bg-background">
			<ScrollAwayChrome hidden={chromeHidden}>
				<header className="flex h-12 shrink-0 items-center gap-1 border-b border-border bg-chrome/60 px-1 md:h-10 md:px-2">
					<Button
						variant="ghost"
						size="icon"
						className="size-12 md:size-8"
						aria-label="Voltar"
						onClick={back}
					>
						<ArrowLeft className="size-4" />
					</Button>
					<div className="min-w-0 flex-1">
						<Title as="h1" size="xs" className="truncate font-mono">
							{name}
							{line && <span className="text-muted-foreground">:{line}</span>}
						</Title>
						<Text
							as="div"
							size="xs"
							tone="muted"
							className="truncate font-mono text-[10px] leading-3"
						>
							{dir}
						</Text>
					</div>
					{file?.kind === "document" && (
						<>
							<Tooltip label="Recarregar documento">
								<Button
									variant="ghost"
									size="icon"
									className="size-12 md:size-8"
									aria-label="Recarregar documento"
									onClick={() => void reloadDocument()}
								>
									<RotateCw className="size-4" />
								</Button>
							</Tooltip>
							<Tooltip label="Abrir no sistema">
								<Button
									variant="ghost"
									size="icon"
									className="size-12 md:size-8"
									aria-label="Abrir no sistema"
									onClick={() =>
										void openLinkTarget(fileHref(file.path), undefined, undefined, true)
									}
								>
									<ExternalLink className="size-4" />
								</Button>
							</Tooltip>
						</>
					)}
					<DropdownMenu>
						<Tooltip label="Compartilhar">
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="size-12 md:size-8"
									aria-label="Compartilhar"
								>
									<Share2 className="size-4" />
								</Button>
							</DropdownMenuTrigger>
						</Tooltip>
						<DropdownMenuContent align="end">
							<DropdownMenuItem
								disabled={!file || !isDesktop() || !window.kowork?.copyFile}
								onSelect={() => void copyFile()}
							>
								<File className="size-4" />
								Copiar arquivo
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={() => void copyPath()}>
								<Link2 className="size-4" />
								Copiar caminho
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</header>
			</ScrollAwayChrome>

			<div
				className="min-h-0 flex-1 overflow-auto overscroll-contain"
				onScroll={(event) => {
					const top = event.currentTarget.scrollTop;
					handleScroll(top - chrome.current.top, top);
					chrome.current.top = top;
				}}
			>
				{file?.kind === "document" && (
					<DocumentPreview
						key={`${file.path}:${documentRevision}`}
						name={file.name}
						format={file.format}
						url={file.url}
						revision={documentRevision}
						onScroll={handleScroll}
					/>
				)}
				{query.isPending && (
					<div className="flex min-h-32 items-center justify-center">
						<Loader2 className="size-5 animate-spin text-muted-foreground" />
					</div>
				)}

				{query.error && (
					<EmptyFeedback
						icon={FileX}
						title="Não foi possível abrir o arquivo"
						subtitle={errorMessage(query.error, "O arquivo não pôde ser lido")}
						className="px-4"
					/>
				)}

				{file?.kind === "image" && (
					<img src={file.dataUrl} alt={file.name} className="mx-auto max-w-full p-3" />
				)}

				{file?.kind === "text" && MARKDOWN_FILE.test(file.name) && (
					<LinkCwdProvider cwd={file.dir}>
						<MarkdownView text={file.content} className="mx-auto w-full max-w-3xl px-4 py-5" />
					</LinkCwdProvider>
				)}

				{file?.kind === "text" && !MARKDOWN_FILE.test(file.name) && (
					<CodeFileView code={file.content} fileName={file.name} line={line} className="py-2" />
				)}

				{file?.kind === "text" && file.truncated && (
					<Text size="xs" tone="muted" className="border-t border-border px-4 py-3">
						Arquivo cortado em 512 KB. Abra no computador para ver o restante.
					</Text>
				)}
			</div>
		</div>
	);
}
