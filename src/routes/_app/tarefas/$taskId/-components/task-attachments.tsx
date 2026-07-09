import { useMutation } from "@tanstack/react-query";
import { FileCode2, FileText } from "lucide-react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { docSheetAction } from "@/components/doc-mobile-actions-drawer";
import { formatBytes } from "@/lib/format-bytes";

type Attachment = {
	name: string;
	size: number;
	mtime: number;
	mime: string;
};

// Artefatos não-texto (.html/.pdf) soltos na pasta da tarefa: uma linha por artefato dentro da
// seção "Tarefa" do menu de ações, cada uma abrindo o arquivo no app padrão do SO (openArtifact).
export function TaskAttachments({
	taskId,
	attachments,
	onAction,
}: {
	taskId: string;
	attachments: Attachment[];
	onAction?: () => void;
}) {
	const openMutation = useMutation({
		...orpc.tasks.openArtifact.mutationOptions(),
		onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao abrir"),
	});

	if (attachments.length === 0) {
		return null;
	}

	return (
		<>
			{attachments.map((attachment) => (
				<button
					key={attachment.name}
					type="button"
					onClick={() => {
						openMutation.mutate({ id: taskId, name: attachment.name });
						onAction?.();
					}}
					className={docSheetAction()}
				>
					<span className="flex size-[18px] shrink-0 items-center justify-center">
						{attachment.mime === "application/pdf" ? (
							<FileText className="size-[18px]" />
						) : (
							<FileCode2 className="size-[18px]" />
						)}
					</span>
					<span className="min-w-0 flex-1 truncate text-left">{attachment.name}</span>
					<span className="shrink-0 text-xs text-muted-foreground">
						{formatBytes(attachment.size)}
					</span>
				</button>
			))}
		</>
	);
}
