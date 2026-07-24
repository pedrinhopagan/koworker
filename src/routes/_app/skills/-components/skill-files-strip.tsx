import { File, FileCode2 } from "lucide-react";

import { Text } from "@/components/typography";
import { ContextMenu } from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import {
	ContextMenuTrigger,
	SkillFileActionsButton,
	SkillFileContextActions,
} from "./skill-file-actions";

export type SkillFileItem = {
	path: string;
	size: number;
	kind: "text" | "binary";
	hash: string;
};

function formatSize(size: number) {
	if (size < 1024) {
		return `${size} B`;
	}
	if (size < 1024 * 1024) {
		return `${(size / 1024).toFixed(1)} KB`;
	}

	return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function SkillFilesStrip({
	files,
	onCopyContent,
	onCopyPath,
	onOpenFolder,
}: {
	files: SkillFileItem[];
	onCopyContent: (file: SkillFileItem) => void;
	onCopyPath: (file: SkillFileItem) => void;
	onOpenFolder: (file: SkillFileItem) => void;
}) {
	if (files.length === 0) {
		return (
			<div className="border-b border-border py-4" data-state="empty">
				<Text size="sm" tone="muted">
					Nenhum arquivo encontrado nesta variante.
				</Text>
			</div>
		);
	}

	return (
		<section data-component="skill-files-strip" className="border-b border-border pb-4">
			<div className="flex items-center justify-between py-2">
				<Text size="xs" tone="muted" className="font-medium uppercase tracking-wide">
					Arquivos · {files.length}
				</Text>
			</div>
			<div className="flex gap-2 overflow-x-auto pb-1">
				{files.map((file) => {
					const actions = {
						path: file.path,
						kind: file.kind,
						onCopyContent: () => onCopyContent(file),
						onCopyPath: () => onCopyPath(file),
						onOpenFolder: () => onOpenFolder(file),
					};

					return (
						<ContextMenu key={file.path}>
							<ContextMenuTrigger asChild>
								<div
									data-slot="skill-file-card"
									data-kind={file.kind}
									data-selected={file.path === "SKILL.md"}
									className={cn(
										"flex min-w-52 max-w-72 shrink-0 items-center gap-2 border px-2 py-1.5",
										file.path === "SKILL.md" ? "border-primary bg-primary/5" : "border-border",
									)}
								>
									{file.kind === "text" ? (
										<FileCode2 className="size-4 shrink-0 text-muted-foreground" />
									) : (
										<File className="size-4 shrink-0 text-muted-foreground" />
									)}
									<div className="min-w-0 flex-1">
										<Text size="xs" className="truncate font-mono">
											{file.path}
										</Text>
										<Text size="xs" tone="muted">
											{file.kind === "binary" ? "Binário" : file.size === 0 ? "Vazio" : "Texto"} ·{" "}
											{formatSize(file.size)}
										</Text>
									</div>
									<SkillFileActionsButton {...actions} />
								</div>
							</ContextMenuTrigger>
							<SkillFileContextActions {...actions} />
						</ContextMenu>
					);
				})}
			</div>
		</section>
	);
}
