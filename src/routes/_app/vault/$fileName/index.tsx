import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, Link2, Loader2, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { DocEditorPane, type DocEditorPaneHandle } from "@/components/doc-editor-pane";
import { DocToolbar } from "@/components/doc-toolbar";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { useRecordDocSession } from "@/hooks/use-record-doc-session";
import { joinPath, openFolderInOs } from "@/lib/os-share";
import { docSessionKey } from "@/stores/doc-sessions";
import { useReadingModeStore } from "@/stores/reading-mode";
import { LinkTaskPopover, type NewTaskPayload } from "../-components/link-task-popover";

export const Route = createFileRoute("/_app/vault/$fileName/")({
	component: VaultFilePage,
});

function VaultFilePage() {
	const { fileName } = Route.useParams();
	const { selectedProjectId, selectedProject } = useProjectFocus();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const paneRef = useRef<DocEditorPaneHandle>(null);
	const reading = useReadingModeStore((s) => s.reading);
	const setReading = useReadingModeStore((s) => s.setReading);

	useEffect(() => () => setReading(false), [setReading]);

	const projectId = selectedProjectId ?? "";
	const enabled = Boolean(selectedProjectId);

	const fileQueryOptions = orpc.vault.getFile.queryOptions({
		input: { projectId, name: fileName },
	});
	const fileQuery = useQuery({ ...fileQueryOptions, enabled });
	const tasksQuery = useQuery({
		...orpc.tasks.listByProject.queryOptions({ input: { projectId } }),
		enabled,
	});

	const file = fileQuery.data ?? null;

	const { pinned, togglePin } = useRecordDocSession(
		file
			? {
					key: docSessionKey({ kind: "vault", projectId, fileName }),
					kind: "vault",
					title: file.title,
					subtitle: file.name,
					projectName: selectedProject?.name,
					projectId,
					nav: { to: "/vault/$fileName", params: { fileName } },
				}
			: null,
	);

	const taskOptions = (tasksQuery.data ?? []).map((task) => ({
		id: task.id,
		displayTitle: task.displayTitle,
	}));

	async function invalidate() {
		await queryClient.invalidateQueries({
			predicate: (query) =>
				Array.isArray(query.queryKey[0]) &&
				(query.queryKey[0][0] === "tasks" || query.queryKey[0][0] === "vault"),
		});
	}

	const writeMutation = useMutation({
		...orpc.vault.writeFile.mutationOptions(),
		onSuccess: () => queryClient.invalidateQueries(fileQueryOptions),
	});

	const promoteMutation = useMutation({
		...orpc.vault.promote.mutationOptions(),
		onSuccess: async (result) => {
			await invalidate();
			toast.success("Nota promovida a tarefa");
			navigate({ to: "/tarefas/$taskId", params: { taskId: result.id } });
		},
		onError: () => toast.error("Não foi possível promover a nota"),
	});

	const linkMutation = useMutation({
		...orpc.vault.linkToTask.mutationOptions(),
		onSuccess: async () => {
			await invalidate();
			toast.success("Nota arquivada na tarefa");
			navigate({ to: "/vault" });
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Não foi possível vincular"),
	});

	const createTaskMutation = useMutation(orpc.tasks.create.mutationOptions());

	async function link(taskId: string, targetName?: string) {
		await paneRef.current?.flush();
		linkMutation.mutate({ projectId, taskId, files: [{ name: fileName, targetName }] });
	}

	// Cria a tarefa de destino vazia (seed: false) e arquiva a nota nela no mesmo passo.
	async function linkNew(payload: NewTaskPayload, targetName?: string) {
		await paneRef.current?.flush();
		try {
			const task = await createTaskMutation.mutateAsync({ projectId, ...payload, seed: false });
			if (!task) throw new Error("Não foi possível criar a tarefa");
			linkMutation.mutate({ projectId, taskId: task.id, files: [{ name: fileName, targetName }] });
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Não foi possível criar a tarefa");
		}
	}

	async function promote() {
		await paneRef.current?.flush();
		promoteMutation.mutate({ projectId, name: fileName });
	}

	if (!selectedProjectId) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4">
				<Text size="sm" tone="muted">
					Selecione um projeto para abrir esta nota.
				</Text>
				<Button variant="outline" asChild>
					<Link to="/vault">Voltar para o vault</Link>
				</Button>
			</div>
		);
	}

	if (fileQuery.isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="flex items-center gap-2 text-muted-foreground">
					<Loader2 size={18} className="animate-spin" />
					<Text size="sm" tone="muted">
						Carregando nota...
					</Text>
				</div>
			</div>
		);
	}

	if (!file) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4">
				<Text size="sm" tone="muted">
					Nota não encontrada — pode já ter sido arquivada em uma tarefa.
				</Text>
				<Button variant="outline" asChild>
					<Link to="/vault">Voltar para o vault</Link>
				</Button>
			</div>
		);
	}

	return (
		<div className="relative flex h-full w-full flex-col">
			{reading ? null : (
				<div className="w-full border-b border-border">
					<div className="mx-auto flex h-10 w-full max-w-6xl items-center gap-2 px-2">
						<Link
							to="/vault"
							className="flex items-center px-2 text-muted-foreground transition-colors hover:text-foreground"
							aria-label="Voltar para o vault"
						>
							<ArrowLeft size={16} />
						</Link>
						<Text size="sm" className="min-w-0 flex-1 truncate font-display font-semibold">
							{file.title}
						</Text>
						<LinkTaskPopover
							tasks={taskOptions}
							loading={tasksQuery.isLoading}
							fileNames={[file.name]}
							pending={linkMutation.isPending || createTaskMutation.isPending}
							onConfirm={(taskId, targetName) => void link(taskId, targetName)}
							onConfirmNew={(payload, targetName) => void linkNew(payload, targetName)}
						>
							<Button variant="outline" size="sm" disabled={linkMutation.isPending}>
								{linkMutation.isPending ? (
									<Loader2 size={14} className="animate-spin" />
								) : (
									<Link2 size={14} />
								)}
								Vincular a tarefa
							</Button>
						</LinkTaskPopover>
						<Button size="sm" onClick={() => void promote()} disabled={promoteMutation.isPending}>
							{promoteMutation.isPending ? (
								<Loader2 size={14} className="animate-spin" />
							) : (
								<ArrowUpRight size={14} />
							)}
							Promover a tarefa
						</Button>
						<div className="h-5 w-px bg-border" aria-hidden="true" />
						<DocToolbar
							onCollapse={() => paneRef.current?.collapseAll()}
							onExpand={() => paneRef.current?.expandAll()}
							onCopyContent={() => void paneRef.current?.copyContent()}
							onCopyPath={() => void paneRef.current?.copyPath()}
							onReading={() => setReading(true)}
							pinned={pinned}
							onTogglePin={togglePin}
							share={
								selectedProject
									? {
											// Nota solta vive em `.koworker/`; "Abrir no sistema" revela a pasta-mãe. Sem
											// copiar conteúdo (já é o botão da toolbar — arquivo único) nem zip (não é pasta).
											onOpenInOs: () =>
												void openFolderInOs(joinPath(selectedProject.mainRoute, ".koworker")),
										}
									: undefined
							}
						/>
					</div>
				</div>
			)}

			{/* Mesma ideia da página de tarefa: overlay em tela cheia na leitura, `display:contents`
			    fora dela. O botão de sair vem depois do editor (posicionado absoluto) pra não deslocar
			    o índice do DocEditorPane e remontar o CodeMirror ao alternar. */}
			<div className={reading ? "fixed inset-0 z-50 flex flex-col bg-background" : "contents"}>
				<DocEditorPane
					ref={paneRef}
					fileName={file.name}
					sessionKey={docSessionKey({ kind: "vault", projectId, fileName })}
					content={file.content}
					folderPath=".koworker"
					writeFile={(payload) => writeMutation.mutateAsync({ projectId, ...payload })}
					reading={reading}
					onExitReading={() => setReading(false)}
					onExit={() => navigate({ to: "/vault" })}
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
