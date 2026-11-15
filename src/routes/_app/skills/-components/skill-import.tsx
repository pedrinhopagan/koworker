import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FileArchive, FileCode2, FolderOpen, Loader2, TriangleAlert, Upload } from "lucide-react";
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";

import { orpc, type RouterOutputs } from "@/client";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { SKILL_SLUG_PATTERN } from "@/constants/skill-slug";
import { useSkillCategoriesQuery } from "@/hooks/use-skill-categories";
import { errorMessage } from "@/lib/orpc-errors";
import { cn } from "@/lib/utils";
import {
	hasImportableDrag,
	importInputFromDataTransfer,
	importInputFromFileList,
	looksLikeSkillText,
	type SkillImportInput,
} from "../-utils/skill-import-input";

type ImportPreview = RouterOutputs["skills"]["importPreview"];

const SkillImportContext = createContext<{ openPicker: () => void }>({ openPicker: () => {} });

const LAST_CATEGORY_KEY = "koworker:skill-import-category";

function readLastCategory() {
	try {
		return localStorage.getItem(LAST_CATEGORY_KEY) ?? "";
	} catch {
		return "";
	}
}

function isEditableTarget(target: EventTarget | null) {
	return (
		target instanceof Element &&
		!!target.closest("input, textarea, [contenteditable='true'], .cm-editor, [role='dialog']")
	);
}

export function SkillImportZone({ children }: { children: ReactNode }) {
	const [open, setOpen] = useState(false);
	const [dragging, setDragging] = useState(false);
	const dragDepth = useRef(0);
	const previewMutation = useMutation(orpc.skills.importPreview.mutationOptions());

	function start(input: SkillImportInput | null) {
		if (!input) {
			toast.info("Nada para importar");
			return;
		}
		setOpen(true);
		previewMutation.mutate(input);
	}

	function close() {
		const token = previewMutation.data?.token;
		if (token) {
			void orpc.skills.importCancel.call({ token }).catch(() => {});
		}
		previewMutation.reset();
		setOpen(false);
	}

	useEffect(() => {
		function onPaste(event: ClipboardEvent) {
			if (open || isEditableTarget(event.target) || !event.clipboardData) return;
			const files = [...event.clipboardData.files];
			const text = event.clipboardData.getData("text/plain");
			if (files.length > 0) {
				event.preventDefault();
				start(importInputFromFileList(event.clipboardData.files));
				return;
			}
			if (looksLikeSkillText(text)) {
				event.preventDefault();
				start({ kind: "text", content: text });
			}
		}
		window.addEventListener("paste", onPaste);
		return () => window.removeEventListener("paste", onPaste);
	});

	return (
		<SkillImportContext.Provider value={{ openPicker: () => setOpen(true) }}>
			<div
				className="relative h-full min-h-0"
				onDragEnter={(event) => {
					if (open || !hasImportableDrag(event.dataTransfer)) return;
					event.preventDefault();
					dragDepth.current += 1;
					setDragging(true);
				}}
				onDragOver={(event) => {
					if (open || !hasImportableDrag(event.dataTransfer)) return;
					event.preventDefault();
					event.dataTransfer.dropEffect = "copy";
				}}
				onDragLeave={() => {
					dragDepth.current = Math.max(0, dragDepth.current - 1);
					if (dragDepth.current === 0) setDragging(false);
				}}
				onDrop={(event) => {
					if (open || !hasImportableDrag(event.dataTransfer)) return;
					event.preventDefault();
					dragDepth.current = 0;
					setDragging(false);
					void importInputFromDataTransfer(event.dataTransfer).then(start, (error) =>
						toast.error(errorMessage(error, "Não foi possível ler o que foi solto")),
					);
				}}
			>
				{children}
				{dragging && (
					<div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center border-2 border-dashed border-primary bg-background/85">
						<div className="flex flex-col items-center gap-2 text-center">
							<Upload className="size-6 text-primary" />
							<Text size="sm" className="font-medium">
								Solte para importar a skill
							</Text>
							<Text size="xs" tone="muted">
								SKILL.md, .md, .zip, pasta ou caminho
							</Text>
						</div>
					</div>
				)}
			</div>
			<SkillImportDialog
				open={open}
				pending={previewMutation.isPending}
				error={previewMutation.error}
				preview={previewMutation.data ?? null}
				onStart={(input) => {
					const token = previewMutation.data?.token;
					if (token) void orpc.skills.importCancel.call({ token }).catch(() => {});
					start(input);
				}}
				onDone={() => {
					previewMutation.reset();
					setOpen(false);
				}}
				onClose={close}
			/>
		</SkillImportContext.Provider>
	);
}

export function SkillImportTile() {
	const { openPicker } = useContext(SkillImportContext);

	return (
		<button
			type="button"
			onClick={openPicker}
			className="group flex min-w-0 flex-col items-center justify-center gap-2 border border-dashed border-border bg-card/40 p-4 text-muted-foreground transition-colors hover:border-foreground/40 hover:bg-secondary/40 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		>
			<div className="flex h-10 w-10 items-center justify-center border border-dashed border-current">
				<Upload className="size-5" />
			</div>
			<div className="font-display text-sm font-semibold">Importar skill</div>
			<div className="text-center text-xs">Arraste SKILL.md, zip ou pasta, ou cole um caminho</div>
		</button>
	);
}

function SkillImportSource({ onStart }: { onStart: (input: SkillImportInput | null) => void }) {
	const [path, setPath] = useState("");
	const [over, setOver] = useState(false);
	const fileInput = useRef<HTMLInputElement>(null);
	const folderInput = useRef<HTMLInputElement>(null);

	return (
		<div className="flex flex-col gap-3">
			<div
				className={cn(
					"flex flex-col items-center gap-2 border border-dashed px-4 py-6 text-center transition-colors",
					over ? "border-primary bg-primary/5" : "border-border",
				)}
				onDragOver={(event) => {
					event.preventDefault();
					setOver(true);
				}}
				onDragLeave={() => setOver(false)}
				onDrop={(event) => {
					event.preventDefault();
					setOver(false);
					void importInputFromDataTransfer(event.dataTransfer).then(onStart);
				}}
			>
				<Upload className="size-5 text-muted-foreground" />
				<Text size="sm">Arraste aqui um SKILL.md, um .md, um .zip ou a pasta da skill</Text>
				<div className="flex flex-wrap justify-center gap-2 pt-1">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => fileInput.current?.click()}
					>
						<FileArchive className="size-3.5" />
						Escolher arquivo
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => folderInput.current?.click()}
					>
						<FolderOpen className="size-3.5" />
						Escolher pasta
					</Button>
				</div>
				<input
					ref={fileInput}
					type="file"
					accept=".md,.zip,text/markdown,application/zip"
					className="hidden"
					onChange={(event) => onStart(importInputFromFileList(event.target.files))}
				/>
				<input
					ref={folderInput}
					type="file"
					className="hidden"
					{...{ webkitdirectory: "" }}
					onChange={(event) => onStart(importInputFromFileList(event.target.files))}
				/>
			</div>
			<form
				className="flex gap-2"
				onSubmit={(event) => {
					event.preventDefault();
					if (path.trim()) onStart({ kind: "path", path: path.trim() });
				}}
			>
				<Input
					value={path}
					onChange={(event) => setPath(event.target.value)}
					placeholder="~/Downloads/minha-skill.zip ou /caminho/SKILL.md"
					className="flex-1 font-mono text-xs"
					aria-label="Caminho da skill"
				/>
				<Button type="submit" variant="outline" size="sm" disabled={!path.trim()}>
					Ler
				</Button>
			</form>
			<Text size="xs" tone="muted">
				Também dá para colar (Ctrl+V) um caminho ou o conteúdo de um SKILL.md direto na página de
				skills.
			</Text>
		</div>
	);
}

function SkillImportDialog({
	open,
	pending,
	error,
	preview,
	onStart,
	onDone,
	onClose,
}: {
	open: boolean;
	pending: boolean;
	error: Error | null;
	preview: ImportPreview | null;
	onStart: (input: SkillImportInput | null) => void;
	onDone: () => void;
	onClose: () => void;
}) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const categories = useSkillCategoriesQuery();
	const [slug, setSlug] = useState("");
	const [description, setDescription] = useState("");
	const [categoryId, setCategoryId] = useState(readLastCategory);
	const [replace, setReplace] = useState(false);

	useEffect(() => {
		setSlug(preview?.slug ?? "");
		setDescription(preview?.description ?? "");
		setReplace(false);
	}, [preview]);

	const validCategory = (categories.data ?? []).some((category) => category.id === categoryId);
	const validSlug = SKILL_SLUG_PATTERN.test(slug);
	const slugQuery = useQuery({
		...orpc.skills.importCheckSlug.queryOptions({ input: { slug } }),
		enabled: !!preview && validSlug && slug !== preview.slug,
	});
	const existing = slug === preview?.slug ? preview.existing : !!slugQuery.data?.existing;

	const commitMutation = useMutation({
		...orpc.skills.importCommit.mutationOptions(),
		onSuccess: (result) => {
			try {
				localStorage.setItem(LAST_CATEGORY_KEY, categoryId);
			} catch {}
			void queryClient.invalidateQueries({ queryKey: orpc.skills.list.key() });
			void queryClient.invalidateQueries({ queryKey: orpc.skills.get.key() });
			toast.success(
				result.backupPath ? `Skill substituída. Backup em ${result.backupPath}` : "Skill importada",
			);
			onDone();
			void navigate({ to: "/skills/$slug", params: { slug: result.slug } });
		},
		onError: (failure: Error) => toast.error(failure.message),
	});

	const canImport =
		!!preview &&
		validSlug &&
		validCategory &&
		description.trim().length > 0 &&
		(!existing || replace) &&
		!commitMutation.isPending;

	return (
		<Dialog
			open={open}
			onClose={onClose}
			title="Importar skill"
			description={
				preview
					? `Lida de ${preview.origin}`
					: "Solte, escolha ou aponte para um SKILL.md, zip ou pasta"
			}
			className="max-w-lg"
			footer={
				preview && (
					<>
						<Button variant="outline" onClick={onClose}>
							Cancelar
						</Button>
						<Button
							disabled={!canImport}
							onClick={() =>
								commitMutation.mutate({
									token: preview.token,
									slug,
									description,
									categoryId,
									replace,
								})
							}
						>
							{commitMutation.isPending ? "Importando..." : existing ? "Substituir" : "Importar"}
						</Button>
					</>
				)
			}
		>
			{pending && (
				<div className="flex items-center gap-2 py-6">
					<Loader2 className="size-4 animate-spin text-muted-foreground" />
					<Text size="sm" tone="muted">
						Lendo a skill...
					</Text>
				</div>
			)}

			{!pending && !preview && (
				<div className="flex flex-col gap-3">
					{error && (
						<div className="flex items-start gap-2 border border-destructive/40 bg-destructive/5 px-3 py-2">
							<TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
							<Text size="sm">{errorMessage(error, "Não foi possível ler a skill")}</Text>
						</div>
					)}
					<SkillImportSource onStart={onStart} />
				</div>
			)}

			{!pending && preview && (
				<div className="flex flex-col gap-4">
					<div className="grid gap-1.5">
						<Label htmlFor="skill-import-slug">Slug</Label>
						<Input
							id="skill-import-slug"
							value={slug}
							onChange={(event) => setSlug(event.target.value.trim())}
							aria-invalid={!validSlug}
							className="font-mono"
						/>
						{!validSlug && (
							<Text size="xs" tone="destructive">
								Use apenas letras minúsculas, números e hífens
							</Text>
						)}
						{validSlug && existing && (
							<label className="flex items-center justify-between gap-3 border border-amber-500/40 bg-amber-500/5 px-3 py-2">
								<Text size="xs">
									Já existe uma skill <span className="font-mono">{slug}</span>. Substituir guarda
									um backup da atual.
								</Text>
								<Switch size="sm" checked={replace} onCheckedChange={setReplace} />
							</label>
						)}
					</div>

					<div className="grid gap-1.5">
						<Label>Categoria</Label>
						<CustomSelect
							items={categories.data ?? []}
							value={validCategory ? categoryId : ""}
							onValueChange={setCategoryId}
							renderItem={(item) => item.name}
							placeholder="Escolha uma categoria"
							ariaLabel="Categoria"
						/>
					</div>

					<div className="grid gap-1.5">
						<Label htmlFor="skill-import-description">Descrição</Label>
						<Textarea
							id="skill-import-description"
							value={description}
							onChange={(event) => setDescription(event.target.value)}
							rows={3}
							className="resize-y"
						/>
						{!preview.hasFrontmatter && (
							<Text size="xs" tone="muted">
								O arquivo não tinha frontmatter; ele será criado com este slug e descrição.
							</Text>
						)}
					</div>

					<div className="grid gap-1.5">
						<Text size="xs" tone="muted" className="font-medium uppercase tracking-wide">
							Arquivos · {preview.files.length}
						</Text>
						<div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto">
							{preview.files.map((file) => (
								<span
									key={file.path}
									className="flex items-center gap-1 border border-border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
								>
									<FileCode2 className="size-3" />
									{file.path}
								</span>
							))}
						</div>
					</div>
				</div>
			)}
		</Dialog>
	);
}
