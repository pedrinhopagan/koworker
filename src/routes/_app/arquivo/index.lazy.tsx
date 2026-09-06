import { useQuery } from "@tanstack/react-query";
import { createLazyFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Copy, FileX, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { CodeFileView } from "@/components/code-file-view";
import { LinkCwdProvider } from "@/components/link-cwd";
import { MarkdownView } from "@/components/markdown-view";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { copyToClipboard } from "@/lib/build-prompt";
import { errorMessage } from "@/lib/orpc-errors";

export const Route = createLazyFileRoute("/_app/arquivo/")({
	component: FileViewerPage,
});

const MARKDOWN_FILE = /\.(md|mdx|markdown)$/i;

function FileViewerPage() {
	const { path, line } = Route.useSearch();
	const router = useRouter();
	const navigate = useNavigate();
	const query = useQuery({
		...orpc.system.readFile.queryOptions({ input: { path } }),
		retry: false,
	});
	const file = query.data ?? null;
	const name = file?.name ?? path.replace(/\/+$/, "").split("/").at(-1) ?? path;
	const dir = file?.dir ?? path.slice(0, Math.max(0, path.length - name.length - 1));

	function back() {
		if (router.history.canGoBack()) {
			router.history.back();
			return;
		}
		void navigate({ to: "/shells", search: {} });
	}

	async function copyPath() {
		if (await copyToClipboard(file?.path ?? path)) {
			toast.success("Caminho copiado");
		}
	}

	return (
		<div data-component="file-viewer" className="flex h-full min-h-0 flex-1 flex-col bg-background">
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
				<Button
					variant="ghost"
					size="icon"
					className="size-12 md:size-8"
					aria-label="Copiar caminho"
					onClick={() => void copyPath()}
				>
					<Copy className="size-4" />
				</Button>
			</header>

			<div className="min-h-0 flex-1 overflow-auto overscroll-contain">
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
