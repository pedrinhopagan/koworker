import { createFileRoute, Link, useBlocker, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	Check,
	ChevronDown,
	Loader2,
	MoreVertical,
	PencilLine,
	SlidersHorizontal,
	Trash2,
	TriangleAlert,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import {
	DocMobileActionsDrawer,
	DocSheetActionButton,
	DocSheetDivider,
} from "@/components/doc-mobile-actions-drawer";
import { DocEditorPane, type DocEditorPaneHandle } from "@/components/doc-editor-pane";
import { DocToolbar } from "@/components/doc-toolbar";
import { TaskTitleInput } from "@/components/tasks/task-meta-controls";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { CustomSelect } from "@/components/ui/custom-select";
import { Dialog } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { SKILL_TOOL_LABEL } from "@/constants/skills";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { useRecordDocSession } from "@/hooks/use-record-doc-session";
import { useSkillCategoriesQuery } from "@/hooks/use-skill-categories";
import { useSkillQuery } from "@/hooks/use-skills";
import { LucideIcon } from "@/lib/lucide-icon";
import { copyToClipboard } from "@/lib/build-prompt";
import { openFolderInOs, shareFolderAsZip } from "@/lib/os-share";
import { cn } from "@/lib/utils";
import { docSessionKey } from "@/stores/doc-sessions";
import { useReadingModeStore } from "@/stores/reading-mode";
import type { SkillCategory, SkillDetail, SkillVariant, TaskSkill } from "@/types/skills";
import { SkillAppearanceDialog } from "../-components/skill-appearance-dialog";
import { SkillCopyMenu } from "../-components/skill-copy-menu";
import { SkillDocumentFrontmatter } from "../-components/skill-document-frontmatter";
import { SkillFilesStrip } from "../-components/skill-files-strip";
import { SkillHeaderActions } from "../-components/skill-header-actions";
import { SkillStandardizeDialog } from "../-components/skill-standardize-dialog";
import { useSkillDocumentAutosave } from "../-utils/use-skill-document-autosave";
import { useSkillMutations } from "../-utils/use-skill-mutations";
import { useSkillSettingsMutation } from "../-utils/use-skill-settings";
import { getSkillConflictNature } from "../-utils/skill-page-actions";

export const Route = createFileRoute("/_app/skills/$slug/")({
	component: SkillPage,
});

function SkillPage() {
	const { slug } = Route.useParams();
	const { selectedProject } = useProjectFocus();
	const projectName = selectedProject?.name;

	const skillQuery = useSkillQuery(slug, projectName);

	if (skillQuery.isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="flex items-center gap-2 text-muted-foreground">
					<Loader2 size={18} className="animate-spin" />
					<Text size="sm" tone="muted">
						Carregando skill...
					</Text>
				</div>
			</div>
		);
	}

	if (!skillQuery.skill) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4">
				<Text size="sm" tone="muted">
					Skill não encontrada.
				</Text>
				<Button variant="outline" asChild>
					<Link to="/skills">Voltar para skills</Link>
				</Button>
			</div>
		);
	}

	return (
		<SkillEditor
			key={skillQuery.skill.slug}
			skill={skillQuery.skill}
			variants={skillQuery.variants}
			missingTools={skillQuery.missingTools}
			projectName={projectName}
		/>
	);
}

// Variantes idênticas compartilham `group`; a cor do ponto distingue os grupos nas tabs.
const GROUP_DOT = [
	"bg-primary",
	"bg-destructive",
	"bg-amber-500",
	"bg-emerald-500",
	"bg-violet-500",
];

function scopeSuffix(scope: SkillVariant["scope"]): string {
	if (scope === "project") return " · projeto";
	if (scope === "custom") return " · custom";
	return "";
}

const CATEGORY_NONE = "__none__";

// Select inline de categoria (padrão do MetaSelect de tarefas): trocar aqui grava
// `skill_settings.categoryId` na hora e, sem cor explícita, a cor da skill passa a herdar o tom da
// categoria. Usado no cabeçalho (compacto) e no drawer mobile (full width).
function SkillCategorySelect({
	categories,
	categoryId,
	onChange,
	className,
}: {
	categories: SkillCategory[];
	categoryId: string | null;
	onChange: (categoryId: string | null) => void;
	className?: string;
}) {
	const items = [
		{ id: CATEGORY_NONE, name: "Sem categoria", color: "#6b7280" },
		...categories.map((category) => ({
			id: category.id,
			name: category.name,
			color: category.color,
		})),
	];
	const value = categoryId ?? CATEGORY_NONE;
	const selected = items.find((item) => item.id === value) ?? items[0];

	return (
		<div className={cn("shrink-0", className)}>
			<CustomSelect
				items={items}
				value={value}
				onValueChange={(next) => onChange(next === CATEGORY_NONE ? null : next)}
				variant="minimal"
				size="sm"
				triggerClassName="gap-1 border border-border bg-muted/40 px-2 text-muted-foreground hover:border-muted-foreground hover:bg-muted hover:text-foreground"
				renderTrigger={() => (
					<>
						<span className="flex min-w-0 items-center gap-1.5">
							<span
								className="size-2 shrink-0 rounded-full"
								style={{ backgroundColor: selected.color }}
							/>
							<span className="truncate text-xs">{selected.name}</span>
						</span>
						<ChevronDown className="size-3.5 shrink-0 opacity-50" />
					</>
				)}
				renderItem={(item, isSelected) => (
					<div className={cn("flex w-full items-center gap-2", isSelected && "font-medium")}>
						<span
							className="size-2 shrink-0 rounded-full"
							style={{ backgroundColor: item.color }}
						/>
						<span className="truncate">{item.name}</span>
					</div>
				)}
			/>
		</div>
	);
}

// Remonta por slug (`key` no parent): navegar skill→skill troca o param sem remontar a rota, e o
// editor markdown só lê `initialContent` no mount — sem o remount o corpo da skill anterior vazaria.
function SkillEditor({
	skill,
	variants,
	missingTools,
	projectName,
}: {
	skill: TaskSkill;
	variants: SkillVariant[];
	missingTools: SkillDetail["missingTools"];
	projectName?: string;
}) {
	const navigate = useNavigate();
	const paneRef = useRef<DocEditorPaneHandle>(null);

	const reading = useReadingModeStore((s) => s.reading);
	const setReading = useReadingModeStore((s) => s.setReading);
	const [editingLabel, setEditingLabel] = useState(false);
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const [confirmingStandardize, setConfirmingStandardize] = useState(false);
	const [appearanceOpen, setAppearanceOpen] = useState(false);
	const [actionsOpen, setActionsOpen] = useState(false);
	const [activeVariantPath, setActiveVariantPath] = useState(skill.primaryPath);

	// Skill é global: a sessão não carrega projeto (não troca o projeto selecionado ao abrir pelo switcher)
	// e a chave ignora o projeto, então a mesma skill grava uma vez só no MRU. Sem subtitle: o slug já é o
	// título, repeti-lo embaixo era ruído.
	const { pinned, togglePin } = useRecordDocSession({
		key: docSessionKey({ kind: "skill", variantPath: activeVariantPath }),
		kind: "skill",
		title: skill.label,
		icon: skill.icon,
		iconColor: skill.color,
		nav: { to: "/skills/$slug", params: { slug: skill.slug } },
	});

	const settingsMutation = useSkillSettingsMutation();
	const categoriesQuery = useSkillCategoriesQuery();
	const {
		updateContent,
		renameSkill,
		renaming,
		standardize,
		standardizing,
		removeSkill,
		removeAllSkill,
		removing,
	} = useSkillMutations();

	useEffect(() => () => setReading(false), [setReading]);

	const activeVariant =
		variants.find((variant) => variant.path === activeVariantPath) ?? variants[0];
	const hasConflict = new Set(variants.map((variant) => variant.contentHash)).size > 1;
	const hasMultipleVariants = variants.length > 1;

	const saveDocument = useCallback(
		async (document: {
			variantPath: string;
			description: string;
			metadata: Record<string, unknown>;
			content: string;
			expectedSkillHash: string;
		}) => await updateContent({ slug: skill.slug, projectName, ...document }),
		[projectName, skill.slug, updateContent],
	);
	const autosave = useSkillDocumentAutosave({
		initialDocument: {
			variantPath: activeVariant.path,
			description: activeVariant.description,
			metadata: activeVariant.metadata,
			content: activeVariant.content,
		},
		initialSkillHash: activeVariant.skillHash,
		save: saveDocument,
	});
	useBlocker({
		disabled: !autosave.pending,
		enableBeforeUnload: () => autosave.pending,
		shouldBlockFn: async () => {
			try {
				await autosave.flush();
				return false;
			} catch {
				return true;
			}
		},
	});

	// Se a variante ativa some (ex.: removeu só esta cópia), cai pra primeira restante. Troca o path
	// → remonta o editor com o conteúdo certo e dispara o reset da descrição abaixo.
	useEffect(() => {
		if (variants.length > 0 && !variants.some((variant) => variant.path === activeVariantPath)) {
			setActiveVariantPath(variants[0].path);
		}
	}, [variants, activeVariantPath]);

	// Colar um SKILL.md completo: o `name` vem do slug ao gravar, então descartamos. A descrição
	// colada vira a descrição da skill; o restante do frontmatter substitui os metadados; o corpo
	// recém-inserido no editor é o conteúdo. Persistimos o trio de uma vez pra não depender do estado
	// desta renderização.
	function applyPastedFrontmatter(frontmatter: Record<string, unknown>, body: string) {
		const { name: _name, description: pastedDesc, ...pastedMeta } = frontmatter;
		const nextDescription =
			typeof pastedDesc === "string" ? pastedDesc : autosave.document.description;

		autosave.schedule({ description: nextDescription, content: body, metadata: pastedMeta }, true);
		toast.success("Metadados aplicados do arquivo colado");
	}

	function saveLabel(value: string) {
		const next = value.trim();
		setEditingLabel(false);
		if (!next || next === skill.label) return;
		settingsMutation.mutate({ slug: skill.slug, label: next });
	}

	async function renameSlug(newSlug: string) {
		await autosave.flush();
		await renameSkill({
			slug: skill.slug,
			newSlug,
			projectName,
			expectedVariants: variants.map((variant) => ({
				path: variant.path,
				contentHash: variant.contentHash,
			})),
		});
		await navigate({ to: "/skills/$slug", params: { slug: newSlug }, replace: true });
	}

	async function selectVariant(path: string) {
		if (path === activeVariantPath) return;
		await autosave.flush();
		setActiveVariantPath(path);
	}

	async function navigateBack() {
		await autosave.flush();
		await navigate({ to: "/skills" });
	}

	// Pasta da variante ativa (absoluta) — alvo de "abrir no SO" e do zip "exportar pasta da skill".
	const skillDir = activeVariant?.dir ?? skill.primaryDir;

	async function copySkillZip() {
		await autosave.flush();
		await shareFolderAsZip(skillDir);
	}

	const multiSource = skill.sources.length > 1;

	async function deleteActiveCopy() {
		await autosave.flush();
		setConfirmingDelete(false);
		removeSkill({
			slug: skill.slug,
			projectName,
			variantPath: activeVariantPath,
		});
		// Última (ou única) cópia → a skill some de vez; senão fica nas fontes restantes.
		if (!multiSource) navigate({ to: "/skills" });
	}

	async function deleteEverywhere() {
		await autosave.flush();
		removeAllSkill({ slug: skill.slug }, () => {
			setConfirmingDelete(false);
			navigate({ to: "/skills" });
		});
	}

	function changeCategory(categoryId: string | null) {
		if (categoryId === skill.categoryId) return;
		settingsMutation.mutate({ slug: skill.slug, categoryId });
	}

	const variantTarget = {
		slug: skill.slug,
		projectName,
		variantPath: activeVariantPath,
	};

	async function copyPath(path: string) {
		await autosave.flush();
		const copied = await copyToClipboard(path);
		toast[copied ? "success" : "error"](copied ? "Caminho copiado" : "Falha ao copiar caminho");
	}

	async function openSkillFolder() {
		await autosave.flush();
		await openFolderInOs(skillDir);
	}

	async function copyFile(relativePath: string) {
		await autosave.flush();
		const { content } = await orpc.skills.readFile.call({
			...variantTarget,
			relativePath,
		});
		const copied = await copyToClipboard(content);
		toast[copied ? "success" : "error"](copied ? "Conteúdo copiado" : "Falha ao copiar conteúdo");
	}

	async function copySkillText() {
		await autosave.flush();
		const result = await orpc.skills.exportText.call(variantTarget);
		const copied = await copyToClipboard(result.content);
		if (!copied) {
			toast.error("Falha ao copiar skill");
			return;
		}
		if (result.omittedBinaryPaths.length > 0) {
			toast.success(`${result.omittedBinaryPaths.length} arquivo(s) binário(s) omitido(s)`);
			return;
		}
		toast.success("Skill copiada como texto");
	}

	const activeVariantLabel = activeVariant
		? `${SKILL_TOOL_LABEL[activeVariant.tool]}${scopeSuffix(activeVariant.scope)}`
		: "";
	const conflictNature = getSkillConflictNature(variants, activeVariantPath);

	const closeActions = () => setActionsOpen(false);
	function runAction(action: Promise<unknown>) {
		void action.catch((error) =>
			toast.error(error instanceof Error ? error.message : "Não foi possível concluir a ação"),
		);
	}

	return (
		<div className="relative flex h-full w-full flex-col">
			{reading ? null : (
				<>
					<div className="w-full border-b border-border">
						<div className="mx-auto flex h-10 w-full max-w-6xl items-center gap-2 px-2">
							<button
								type="button"
								onClick={() => runAction(navigateBack())}
								className="flex items-center px-2 text-muted-foreground transition-colors hover:text-foreground"
								aria-label="Voltar para skills"
							>
								<ArrowLeft size={16} />
							</button>
							<div
								className="flex size-6 shrink-0 items-center justify-center border"
								style={{ borderColor: skill.color, color: skill.color }}
							>
								<LucideIcon name={skill.icon} className="size-3.5" />
							</div>
							{editingLabel ? (
								<div className="min-w-0 flex-1">
									<TaskTitleInput
										initialValue={skill.label}
										placeholder={skill.slug}
										onSave={saveLabel}
										onCancel={() => setEditingLabel(false)}
									/>
								</div>
							) : (
								<button
									type="button"
									onClick={() => setEditingLabel(true)}
									className="group flex min-w-0 flex-1 items-center gap-1.5 text-left"
									title="Renomear skill"
								>
									<Text size="sm" className="min-w-0 truncate font-display font-semibold">
										{skill.label}
									</Text>
									<PencilLine className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
								</button>
							)}

							<div className="flex shrink-0 items-center gap-1">
								{skill.sources.map((source) => (
									<Chip key={source.path} size="xs" variant="ghost">
										{SKILL_TOOL_LABEL[source.tool]}
										{scopeSuffix(source.scope)}
									</Chip>
								))}
							</div>

							{/* Principais inline (desktop): categoria, copiar e replicar. O resto vive no menu
							    de ações. No mobile a linha inteira degrada para o drawer (padrão do vault). */}
							<div className="hidden items-center gap-2 md:flex">
								<SkillCategorySelect
									categories={categoriesQuery.data ?? []}
									categoryId={skill.categoryId}
									onChange={changeCategory}
									className="w-40"
								/>
								<SkillCopyMenu
									onCopySkill={() => copyFile("SKILL.md")}
									onCopyText={copySkillText}
									onCopyZip={copySkillZip}
									flush={autosave.flush}
								/>
								<SkillHeaderActions
									pinned={pinned}
									onAppearance={() => setAppearanceOpen(true)}
									onTogglePin={togglePin}
									onReading={() => setReading(true)}
									onCollapse={() => paneRef.current?.collapseAll()}
									onExpand={() => paneRef.current?.expandAll()}
									onCopyPath={() => runAction(copyPath(`${skillDir}/SKILL.md`))}
									onOpenInOs={() => runAction(openSkillFolder())}
									onShareZip={() => runAction(copySkillZip())}
									onDelete={() => setConfirmingDelete(true)}
								/>
							</div>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								onClick={() => setActionsOpen(true)}
								aria-label="Ações da skill"
								className="h-8 w-8 shrink-0 md:hidden"
							>
								<MoreVertical className="h-4 w-4" />
							</Button>
						</div>
					</div>

					<DocMobileActionsDrawer open={actionsOpen} onClose={closeActions} title="Ações da skill">
						<div className="px-5 py-2">
							<Text size="xs" tone="muted" className="mb-1.5">
								Categoria
							</Text>
							<SkillCategorySelect
								categories={categoriesQuery.data ?? []}
								categoryId={skill.categoryId}
								onChange={changeCategory}
								className="w-full"
							/>
						</div>
						<DocSheetDivider />
						<DocSheetActionButton
							icon={<SlidersHorizontal className="size-[18px]" />}
							label="Aparência"
							onClick={() => {
								setAppearanceOpen(true);
								closeActions();
							}}
						/>
						<DocSheetDivider />
						<div className="flex justify-center px-5 py-2">
							<SkillCopyMenu
								onCopySkill={() => copyFile("SKILL.md")}
								onCopyText={copySkillText}
								onCopyZip={copySkillZip}
								flush={autosave.flush}
							/>
						</div>
						<DocSheetDivider />
						<DocToolbar
							onCollapse={() => paneRef.current?.collapseAll()}
							onExpand={() => paneRef.current?.expandAll()}
							onCopyPath={() => runAction(copyPath(`${skillDir}/SKILL.md`))}
							onReading={() => setReading(true)}
							pinned={pinned}
							onTogglePin={togglePin}
							share={{
								onOpenInOs: () => runAction(openSkillFolder()),
								onCopyZip: () => runAction(copySkillZip()),
							}}
							layout="stacked"
							onAction={closeActions}
						/>
						<DocSheetDivider />
						<DocSheetActionButton
							icon={<Trash2 className="size-[18px]" />}
							label="Excluir skill"
							onClick={() => {
								setConfirmingDelete(true);
								closeActions();
							}}
							className="text-destructive"
						/>
					</DocMobileActionsDrawer>

					{(hasMultipleVariants || missingTools.length > 0) && (
						<div className="w-full border-b border-border">
							<div className="mx-auto flex h-8 w-full max-w-6xl items-stretch">
								<div
									className="flex min-w-0 flex-1 items-stretch overflow-x-auto"
									role={hasMultipleVariants ? "tablist" : undefined}
									aria-label={hasMultipleVariants ? "Variantes da skill" : undefined}
								>
									{!hasMultipleVariants && (
										<div className="flex min-w-0 items-center gap-1.5 px-3 text-xs text-muted-foreground">
											<TriangleAlert className="size-3.5 shrink-0 text-amber-500" />
											<span className="truncate">
												Falta em {missingTools.map((tool) => SKILL_TOOL_LABEL[tool]).join(", ")}
											</span>
										</div>
									)}
									{hasMultipleVariants &&
										variants.map((variant) => {
											const isActive = variant.path === activeVariantPath;
											return (
												<button
													key={variant.path}
													type="button"
													onClick={() => runAction(selectVariant(variant.path))}
													className={cn(
														"flex h-full shrink-0 items-center justify-center gap-1.5 border-l border-border px-3 text-xs transition-colors",
														isActive
															? "bg-secondary text-foreground"
															: "text-muted-foreground hover:bg-secondary/50",
													)}
													title={variant.path}
													role="tab"
													aria-selected={isActive}
												>
													<span
														className={cn(
															"size-1.5 shrink-0 rounded-full",
															GROUP_DOT[variant.group % GROUP_DOT.length],
														)}
														aria-hidden
													/>
													<span className="truncate">
														{SKILL_TOOL_LABEL[variant.tool]}
														{scopeSuffix(variant.scope)}
													</span>
												</button>
											);
										})}
								</div>
								<div className="flex shrink-0 items-stretch border-l border-border">
									<button
										type="button"
										onClick={() => setConfirmingStandardize(true)}
										disabled={standardizing}
										className="flex items-center gap-1.5 px-3 text-xs text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground disabled:opacity-50"
										aria-label="Tornar como principal"
										title="Criar esta skill nas CLIs que ainda não a têm"
									>
										<Check size={14} />
										<span className="hidden sm:inline">Tornar como principal</span>
									</button>
									{hasConflict && (
										<Tooltip label={conflictNature ?? "Variantes divergem"} side="bottom">
											<button
												type="button"
												aria-label={conflictNature ?? "Variantes divergem"}
												className="flex h-full items-center px-2 text-amber-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
											>
												<TriangleAlert className="size-3.5" />
											</button>
										</Tooltip>
									)}
								</div>
							</div>
						</div>
					)}
				</>
			)}

			{/* Mesma estrutura de tarefa/vault: overlay em tela cheia na leitura, `display:contents`
			    fora dela. Keyado pela variante ativa pra remontar o editor ao trocar de tab. */}
			<div className={reading ? "fixed inset-0 z-50 flex flex-col bg-background" : "contents"}>
				<DocEditorPane
					key={activeVariantPath}
					ref={paneRef}
					fileName="SKILL.md"
					sessionKey={docSessionKey({
						kind: "skill",
						variantPath: activeVariantPath,
					})}
					content={activeVariant?.content ?? skill.instructions}
					folderPath={activeVariant?.dir ?? skill.primaryDir}
					documentMaxWidth="52rem"
					externalSave={{
						schedule: (content) => autosave.schedule({ content }),
						flush: autosave.flush,
					}}
					beforeEditor={
						<>
							<SkillFilesStrip
								files={activeVariant.files}
								onCopyContent={(file) => runAction(copyFile(file.path))}
								onCopyPath={(file) => runAction(copyPath(file.path))}
								onOpenFolder={() => runAction(openSkillFolder())}
							/>
							<SkillDocumentFrontmatter
								slug={skill.slug}
								description={autosave.document.description}
								metadata={autosave.document.metadata}
								status={autosave.status}
								renaming={renaming}
								onSlugCommit={renameSlug}
								onDescriptionChange={(description) => autosave.schedule({ description })}
								onDescriptionCommit={() => runAction(autosave.flush())}
								onMetadataChange={(metadata) => autosave.schedule({ metadata }, true)}
							/>
						</>
					}
					onPasteFrontmatter={applyPastedFrontmatter}
					reading={reading}
					onExitReading={() => setReading(false)}
					onExit={() => void navigate({ to: "/skills" })}
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

			<Dialog
				open={confirmingDelete}
				onClose={() => setConfirmingDelete(false)}
				title="Remover skill"
				description={
					multiSource
						? `“${skill.label}” existe em ${skill.sources.length} fontes. Escolha o que apagar do disco.`
						: `“${skill.label}” será salva no backup e removida de todas as fontes configuradas.`
				}
				className="max-w-md"
				footer={
					<div className="flex w-full flex-wrap justify-end gap-2">
						<Button variant="outline" size="sm" onClick={() => setConfirmingDelete(false)}>
							Cancelar
						</Button>
						{multiSource ? (
							<>
								<Button
									variant="outline"
									size="sm"
									onClick={() => runAction(deleteActiveCopy())}
									disabled={removing}
									className="text-destructive"
								>
									Só esta cópia ({activeVariant ? SKILL_TOOL_LABEL[activeVariant.tool] : ""}
									{activeVariant ? scopeSuffix(activeVariant.scope) : ""})
								</Button>
								<Button
									variant="destructive"
									size="sm"
									onClick={() => runAction(deleteEverywhere())}
									disabled={removing}
								>
									Todas as {skill.sources.length} fontes
								</Button>
							</>
						) : (
							<Button
								variant="destructive"
								size="sm"
								onClick={() => runAction(deleteEverywhere())}
								disabled={removing}
							>
								Deletar
							</Button>
						)}
					</div>
				}
			>
				<Text size="sm" tone="muted">
					{multiSource
						? "“Só esta cópia” remove apenas a pasta selecionada; “todas as fontes” cria um backup e remove a skill de todos os projetos."
						: "Uma cópia completa será salva em ~/Documentos/backups/koworker/skills/ antes da remoção em todos os projetos."}
				</Text>
			</Dialog>

			<SkillAppearanceDialog
				skill={appearanceOpen ? skill : null}
				onClose={() => setAppearanceOpen(false)}
			/>

			<SkillStandardizeDialog
				open={confirmingStandardize}
				label={activeVariantLabel}
				flush={autosave.flush}
				loadPreview={async () => await orpc.skills.standardizePreview.call(variantTarget)}
				apply={async (planHash) => await standardize({ ...variantTarget, planHash })}
				onClose={() => setConfirmingStandardize(false)}
			/>
		</div>
	);
}
