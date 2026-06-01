import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { orpc } from "@/client";
import { DocEditorPane, type DocEditorPaneHandle } from "@/components/doc-editor-pane";
import { DocToolbar } from "@/components/doc-toolbar";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { useRecordDocSession } from "@/hooks/use-record-doc-session";
import { docSessionKey } from "@/stores/doc-sessions";
import { useReadingModeStore } from "@/stores/reading-mode";

export const Route = createFileRoute("/_app/projetos/$projetoId/docs/$")({
	component: ProjectDocPage,
});

function ProjectDocPage() {
	const { projetoId, _splat } = Route.useParams();
	const docPath = _splat ?? "";
	const queryClient = useQueryClient();
	const { projects } = useProjectFocus();
	const paneRef = useRef<DocEditorPaneHandle>(null);
	const reading = useReadingModeStore((s) => s.reading);
	const setReading = useReadingModeStore((s) => s.setReading);

	useEffect(() => () => setReading(false), [setReading]);

	const docsQueryOptions = orpc.projects.listDocs.queryOptions({ input: { id: projetoId } });
	const docsQuery = useQuery(docsQueryOptions);

	const file = docsQuery.data?.find((entry) => entry.path === docPath) ?? null;

	const { pinned, togglePin } = useRecordDocSession(
		file
			? {
					key: docSessionKey({ kind: "docs", projectId: projetoId, path: docPath }),
					kind: "docs",
					title: file.name,
					subtitle: file.dirLabel || undefined,
					projectName: projects.find((project) => project.id === projetoId)?.name,
					nav: { to: "/projetos/$projetoId/docs/$", params: { projetoId, _splat: docPath } },
				}
			: null,
	);

	const writeMutation = useMutation({
		...orpc.projects.writeDoc.mutationOptions(),
		onSuccess: () => queryClient.invalidateQueries(docsQueryOptions),
	});

	if (docsQuery.isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="flex items-center gap-2 text-muted-foreground">
					<Loader2 size={18} className="animate-spin" />
					<Text size="sm" tone="muted">
						Carregando documento...
					</Text>
				</div>
			</div>
		);
	}

	if (!file) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4">
				<Text size="sm" tone="muted">
					Documento não encontrado no projeto.
				</Text>
				<Button variant="outline" asChild>
					<Link to="/projetos" search={{ projetoId }}>
						Voltar para o projeto
					</Link>
				</Button>
			</div>
		);
	}

	const dir = docPath.slice(0, docPath.length - file.name.length - 1) || ".";

	return (
		<div className="relative flex h-full w-full flex-col">
			{reading ? null : (
				<div className="w-full border-b border-border">
					<div className="mx-auto flex h-10 w-full max-w-6xl items-center gap-2 px-2">
						<Link
							to="/projetos"
							search={{ projetoId }}
							className="flex items-center px-2 text-muted-foreground transition-colors hover:text-foreground"
							aria-label="Voltar para o projeto"
						>
							<ArrowLeft size={16} />
						</Link>
						<Text size="sm" className="min-w-0 flex-1 truncate font-mono font-semibold">
							{file.dirLabel}
							{file.name}
						</Text>
						<DocToolbar
							onCollapse={() => paneRef.current?.collapseAll()}
							onExpand={() => paneRef.current?.expandAll()}
							onCopyContent={() => void paneRef.current?.copyContent()}
							onCopyPath={() => void paneRef.current?.copyPath()}
							onReading={() => setReading(true)}
							pinned={pinned}
							onTogglePin={togglePin}
						/>
					</div>
				</div>
			)}

			<div className={reading ? "fixed inset-0 z-50 flex flex-col bg-background" : "contents"}>
				<DocEditorPane
					ref={paneRef}
					fileName={file.name}
					sessionKey={docSessionKey({ kind: "docs", projectId: projetoId, path: docPath })}
					content={file.content}
					folderPath={dir}
					writeFile={(payload) =>
						writeMutation.mutateAsync({ id: projetoId, path: docPath, content: payload.content })
					}
					reading={reading}
					onExitReading={() => setReading(false)}
				/>
				{reading ? (
					<Button
						variant="outline"
						size="sm"
						onClick={() => setReading(false)}
						className="absolute top-2 right-3 z-20"
						title="Sair do modo leitura (Esc)"
					>
						<X size={16} />
						Sair da leitura
					</Button>
				) : null}
			</div>
		</div>
	);
}
