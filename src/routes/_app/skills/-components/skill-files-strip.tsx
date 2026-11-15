import { ChevronDown, File, FileCode2, FolderTree, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Text } from "@/components/typography";
import { ContextMenu } from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { normalizeSearchText } from "@/lib/skill-search";
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

const INLINE_LIMIT = 8;

type FileHandlers = {
	onOpen: (file: SkillFileItem) => void;
	onCopyContent: (file: SkillFileItem) => void;
	onCopyPath: (file: SkillFileItem) => void;
	onOpenFolder: (file: SkillFileItem) => void;
};

function fileName(path: string) {
	return path.slice(path.lastIndexOf("/") + 1);
}

function fileMeta(file: SkillFileItem) {
	if (file.kind === "binary") return `Binário · ${formatSize(file.size)}`;
	if (file.size === 0) return "Vazio";

	return formatSize(file.size);
}

function fileActions(file: SkillFileItem, handlers: FileHandlers) {
	return {
		path: file.path,
		kind: file.kind,
		onCopyContent: () => handlers.onCopyContent(file),
		onCopyPath: () => handlers.onCopyPath(file),
		onOpenFolder: () => handlers.onOpenFolder(file),
	};
}

function FileChip({
	file,
	selected,
	label,
	handlers,
}: {
	file: SkillFileItem;
	selected: boolean;
	label: string;
	handlers: FileHandlers;
}) {
	const actions = fileActions(file, handlers);
	const meta = fileMeta(file);

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<div
					data-slot="skill-file-card"
					data-kind={file.kind}
					data-selected={selected}
					className={cn(
						"flex h-6 min-w-0 max-w-full items-center gap-1 border pl-1.5",
						selected
							? "border-primary bg-primary/10 text-foreground"
							: "border-border text-muted-foreground hover:text-foreground",
					)}
				>
					<button
						type="button"
						onClick={() => handlers.onOpen(file)}
						disabled={file.kind === "binary"}
						title={`${file.path} · ${meta}`}
						aria-current={selected}
						className="flex min-w-0 items-center gap-1 text-left disabled:cursor-default"
					>
						{file.kind === "text" ? (
							<FileCode2 className="size-3 shrink-0" />
						) : (
							<File className="size-3 shrink-0" />
						)}
						<span className="truncate font-mono text-[11px]">{label}</span>
						<span className="shrink-0 text-[10px] text-muted-foreground">{meta}</span>
					</button>
					<SkillFileActionsButton {...actions} />
				</div>
			</ContextMenuTrigger>
			<SkillFileContextActions {...actions} />
		</ContextMenu>
	);
}

function SkillFilesBrowser({
	files,
	activePath,
	handlers,
}: {
	files: SkillFileItem[];
	activePath: string;
	handlers: FileHandlers;
}) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const folders = new Set(files.map((file) => file.path.split("/").slice(0, -1).join("/"))).size;
	const groups = useMemo(() => {
		const term = normalizeSearchText(query.trim());
		const matching = term
			? files.filter((file) => normalizeSearchText(file.path).includes(term))
			: files;
		return groupByDirectory(matching);
	}, [files, query]);
	const firstText = groups.flatMap(([, entries]) => entries).find((file) => file.kind === "text");

	function openFile(file: SkillFileItem) {
		handlers.onOpen(file);
		setOpen(false);
		setQuery("");
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					data-slot="skill-files-browser"
					className="flex h-6 items-center gap-1.5 border border-border px-2 text-xs text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground data-[state=open]:bg-secondary/60 data-[state=open]:text-foreground"
				>
					<FolderTree className="size-3" />
					Arquivos
					<span className="tabular-nums opacity-70">
						· {files.length} em {folders} {folders === 1 ? "pasta" : "pastas"}
					</span>
					<ChevronDown className="size-3" />
				</button>
			</PopoverTrigger>
			<PopoverContent align="start" className="flex w-[min(30rem,calc(100vw-2rem))] flex-col p-0">
				<div className="relative border-b border-border p-2">
					<Search className="pointer-events-none absolute top-1/2 left-4 size-3.5 -translate-y-1/2 text-muted-foreground" />
					<Input
						autoFocus
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter" && firstText) {
								event.preventDefault();
								openFile(firstText);
							}
						}}
						placeholder="Filtrar arquivos"
						className="h-7 pl-7 font-mono text-xs"
					/>
				</div>
				<div className="max-h-[min(60vh,28rem)] overflow-y-auto py-1">
					{groups.length === 0 && (
						<Text size="xs" tone="muted" className="px-3 py-2">
							Nenhum arquivo corresponde ao filtro.
						</Text>
					)}
					{groups.map(([directory, entries]) => (
						<div key={directory || "."}>
							<div className="sticky top-0 z-10 flex items-center justify-between bg-popover px-3 pt-2 pb-1">
								<span className="truncate font-mono text-[11px] text-muted-foreground">
									{directory ? `${directory}/` : "raiz"}
								</span>
								<span className="text-[10px] tabular-nums text-muted-foreground">
									{entries.length}
								</span>
							</div>
							{entries.map((file) => {
								const selected = file.path === activePath;
								return (
									<div
										key={file.path}
										className={cn(
											"group flex items-center gap-2 pr-1 pl-3",
											selected ? "bg-primary/10 text-foreground" : "hover:bg-accent",
										)}
									>
										<button
											type="button"
											disabled={file.kind === "binary"}
											onClick={() => openFile(file)}
											title={file.path}
											className="flex h-7 min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-default disabled:opacity-60"
										>
											{file.kind === "text" ? (
												<FileCode2 className="size-3.5 shrink-0 text-muted-foreground" />
											) : (
												<File className="size-3.5 shrink-0 text-muted-foreground" />
											)}
											<span className="min-w-0 flex-1 truncate font-mono text-xs">
												{fileName(file.path)}
											</span>
											<span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
												{fileMeta(file)}
											</span>
										</button>
										<SkillFileActionsButton {...fileActions(file, handlers)} />
									</div>
								);
							})}
						</div>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
}

export function SkillFilesStrip({
	files,
	activePath,
	...handlers
}: FileHandlers & {
	files: SkillFileItem[];
	activePath: string;
}) {
	if (files.length === 0) {
		return (
			<Text size="xs" tone="muted" data-state="empty">
				Nenhum arquivo encontrado nesta variante.
			</Text>
		);
	}

	if (files.length > INLINE_LIMIT) {
		const pinned = files.filter((file) => file.path === "SKILL.md" || file.path === activePath);
		return (
			<section
				data-component="skill-files-strip"
				className="flex min-w-0 flex-wrap items-center gap-1.5"
			>
				{pinned.map((file) => (
					<FileChip
						key={file.path}
						file={file}
						selected={file.path === activePath}
						label={file.path}
						handlers={handlers}
					/>
				))}
				<SkillFilesBrowser files={files} activePath={activePath} handlers={handlers} />
			</section>
		);
	}

	return (
		<section
			data-component="skill-files-strip"
			className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1"
		>
			{groupByDirectory(files).map(([directory, entries]) => (
				<div key={directory || "."} className="flex min-w-0 flex-wrap items-center gap-1">
					{directory && (
						<Text as="span" size="xs" tone="muted" className="font-mono">
							{directory}/
						</Text>
					)}
					{entries.map((file) => (
						<FileChip
							key={file.path}
							file={file}
							selected={file.path === activePath}
							label={fileName(file.path)}
							handlers={handlers}
						/>
					))}
				</div>
			))}
		</section>
	);
}
