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

// Agrupa por pasta (raiz primeiro, depois alfabética) e mostra só o nome do arquivo no card: o
// caminho inteiro em cada card estourava a largura e a faixa rolava na horizontal, escondendo
// justamente o que a tela precisa mostrar — tudo que acompanha a skill.
function groupByDirectory(files: SkillFileItem[]) {
	const groups = new Map<string, SkillFileItem[]>();
	for (const file of files) {
		const separator = file.path.lastIndexOf("/");
		const directory = separator === -1 ? "" : file.path.slice(0, separator);
		const existing = groups.get(directory);
		if (existing) {
			existing.push(file);
		} else {
			groups.set(directory, [file]);
		}
	}

	return [...groups].sort(([a], [b]) => {
		if (a === "") return -1;
		if (b === "") return 1;
		return a.localeCompare(b);
	});
}

export function SkillFilesStrip({
	files,
	activePath,
	onOpen,
	onCopyContent,
	onCopyPath,
	onOpenFolder,
}: {
	files: SkillFileItem[];
	activePath: string;
	onOpen: (file: SkillFileItem) => void;
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
			<div className="flex flex-col gap-3">
				{groupByDirectory(files).map(([directory, entries]) => (
					<div key={directory || "."} className="flex flex-col gap-1.5">
						{directory && (
							<Text size="xs" tone="muted" className="font-mono">
								{directory}/
							</Text>
						)}
						<div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2">
							{entries.map((file) => {
								const actions = {
									path: file.path,
									kind: file.kind,
									onCopyContent: () => onCopyContent(file),
									onCopyPath: () => onCopyPath(file),
									onOpenFolder: () => onOpenFolder(file),
								};
								const selected = file.path === activePath;
								const name = file.path.slice(file.path.lastIndexOf("/") + 1);

								return (
									<ContextMenu key={file.path}>
										<ContextMenuTrigger asChild>
											<div
												data-slot="skill-file-card"
												data-kind={file.kind}
												data-selected={selected}
												className={cn(
													"flex min-w-0 items-center gap-2 border pr-1 pl-2",
													selected ? "border-primary bg-primary/5" : "border-border",
												)}
											>
												{/* Binário não abre no editor: o card fica só com as ações. */}
												<button
													type="button"
													onClick={() => onOpen(file)}
													disabled={file.kind === "binary"}
													title={file.path}
													aria-current={selected}
													className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left disabled:cursor-default"
												>
													{file.kind === "text" ? (
														<FileCode2 className="size-4 shrink-0 text-muted-foreground" />
													) : (
														<File className="size-4 shrink-0 text-muted-foreground" />
													)}
													<span className="min-w-0 flex-1">
														<Text as="span" size="xs" className="block truncate font-mono">
															{name}
														</Text>
														<Text as="span" size="xs" tone="muted" className="block">
															{file.kind === "binary"
																? "Binário"
																: file.size === 0
																	? "Vazio"
																	: "Texto"}{" "}
															· {formatSize(file.size)}
														</Text>
													</span>
												</button>
												<SkillFileActionsButton {...actions} />
											</div>
										</ContextMenuTrigger>
										<SkillFileContextActions {...actions} />
									</ContextMenu>
								);
							})}
						</div>
					</div>
				))}
			</div>
		</section>
	);
}
