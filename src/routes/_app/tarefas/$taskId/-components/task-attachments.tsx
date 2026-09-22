import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FileCode2, FileText } from "lucide-react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { isPreviewDocument } from "@/lib/file-preview";
import { docSheetAction } from "@/components/doc-mobile-actions-drawer";
import { formatBytes } from "@/lib/format-bytes";

type Attachment = {
	name: string;
	size: number;
	mtime: number;
	mime: string;
};

export function TaskAttachments({
	taskId,
	folderAbs,
	attachments,
	onAction,
}: {
	taskId: string;
	folderAbs: string | null;
	attachments: Attachment[];
	onAction?: () => void;
}) {
	const navigate = useNavigate();
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
					onClick={(event) => {
						if (event.altKey || !folderAbs || !isPreviewDocument(attachment.name)) {
							openMutation.mutate({ id: taskId, name: attachment.name });
						} else {
							void navigate({
								to: "/arquivo",
								search: { path: `${folderAbs}/${attachment.name}` },
							});
						}
						onAction?.();
					}}
					onAuxClick={(event) => {
						if (event.button === 1) {
							event.preventDefault();
							openMutation.mutate({ id: taskId, name: attachment.name });
							onAction?.();
						}
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
