import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileCode2, FileText, FolderInput, Loader2, Presentation } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { AssetViewer } from "@/components/asset-viewer";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip } from "@/components/ui/tooltip";
import { formatBytes } from "@/lib/format-bytes";
import { cn } from "@/lib/utils";

type Attachment = {
	name: string;
	size: number;
	mtime: number;
	mime: string;
};

type TaskAttachmentsProps = {
	taskId: string;
	attachments: Attachment[];
};

// Artefatos não-texto (.html/.pdf) soltos na pasta da tarefa: um botão no header abre a lista, de
// onde dá pra visualizar cada um inline (viewer via readArtifact) ou mover o conjunto pro
// mostruário. O par .html/.pdf de mesmo basename vai junto no move (resolvido no backend).
export function TaskAttachments({ taskId, attachments }: TaskAttachmentsProps) {
	const queryClient = useQueryClient();
	const [viewing, setViewing] = useState<Attachment | null>(null);

	const artifactQuery = useQuery({
		...orpc.tasks.readArtifact.queryOptions({ input: { id: taskId, name: viewing?.name ?? "" } }),
		enabled: viewing !== null,
	});

	const moveMutation = useMutation({
		...orpc.mostruario.moveFromTask.mutationOptions(),
		onSuccess: async (result) => {
			await queryClient.invalidateQueries(
				orpc.tasks.getFull.queryOptions({ input: { id: taskId } }),
			);
			queryClient.invalidateQueries({
				predicate: (query) =>
					Array.isArray(query.queryKey[0]) && query.queryKey[0][0] === "mostruario",
			});
			toast.success(`${result.moved.length} arquivo(s) movido(s) para o Mostruário`);
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao mover"),
	});

	if (attachments.length === 0) {
		return null;
	}

	return (
		<>
			<Popover>
				<Tooltip label="Anexos (.html/.pdf)">
					<PopoverTrigger asChild>
						<button
							type="button"
							className="relative flex size-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
							aria-label="Anexos da tarefa"
						>
							<Presentation className="h-4 w-4" />
							<span className="absolute -top-1 -right-1 min-w-3 rounded-[3px] bg-[var(--project-accent,var(--primary))]/30 px-0.5 text-center font-semibold text-[8px] text-[var(--project-accent,var(--primary))] leading-[11px]">
								{attachments.length}
							</span>
						</button>
					</PopoverTrigger>
				</Tooltip>
				<PopoverContent align="end" className="w-80 p-2">
					<Text size="xs" tone="muted" className="px-1 pb-1.5">
						Artefatos desta tarefa
					</Text>
					<div className="flex flex-col">
						{attachments.map((attachment) => (
							<button
								key={attachment.name}
								type="button"
								onClick={() => setViewing(attachment)}
								className="flex items-center gap-2 px-1 py-1.5 text-left transition-colors hover:bg-muted/50"
							>
								{attachment.mime === "application/pdf" ? (
									<FileText className="size-4 shrink-0 text-muted-foreground" />
								) : (
									<FileCode2 className="size-4 shrink-0 text-muted-foreground" />
								)}
								<span className="min-w-0 flex-1 truncate text-sm">{attachment.name}</span>
								<span className="shrink-0 text-xs text-muted-foreground">
									{formatBytes(attachment.size)}
								</span>
							</button>
						))}
					</div>
					<div className="mt-1.5 border-t border-border pt-1.5">
						<Button
							size="sm"
							variant="outline"
							className="w-full"
							onClick={() => moveMutation.mutate({ taskId })}
							disabled={moveMutation.isPending}
						>
							{moveMutation.isPending ? (
								<Loader2 className="size-3.5 animate-spin" />
							) : (
								<FolderInput className="size-3.5" />
							)}
							Mover para o Mostruário
						</Button>
					</div>
				</PopoverContent>
			</Popover>

			{viewing ? (
				<div className="fixed inset-0 z-50 flex flex-col bg-background">
					<div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-2">
						<button
							type="button"
							onClick={() => setViewing(null)}
							className="flex items-center px-2 text-muted-foreground transition-colors hover:text-foreground"
							aria-label="Fechar"
						>
							<ArrowLeft size={16} />
						</button>
						<Text size="sm" className="min-w-0 flex-1 truncate font-medium">
							{viewing.name}
						</Text>
					</div>
					<div className={cn("min-h-0 flex-1")}>
						<AssetViewer
							blob={artifactQuery.data}
							name={viewing.name}
							isLoading={artifactQuery.isLoading}
							isError={artifactQuery.isError}
						/>
					</div>
				</div>
			) : null}
		</>
	);
}
