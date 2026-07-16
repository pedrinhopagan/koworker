import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	Check,
	ChevronDown,
	ClipboardCopy,
	CopyPlus,
	Loader2,
	MoreVertical,
	PencilLine,
	SlidersHorizontal,
	Trash2,
	TriangleAlert,
	X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CustomSelect } from "@/components/ui/custom-select";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { SKILL_TOOL_LABEL } from "@/constants/skills";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { useRecordDocSession } from "@/hooks/use-record-doc-session";
import { useSkillCategoriesQuery } from "@/hooks/use-skill-categories";
import { useSkillQuery } from "@/hooks/use-skills";
import { LucideIcon } from "@/lib/lucide-icon";
import { openFolderInOs, shareFolderAsZip } from "@/lib/os-share";
import { cn } from "@/lib/utils";
import { docSessionKey } from "@/stores/doc-sessions";
import { useReadingModeStore } from "@/stores/reading-mode";
import type { SkillCategory, SkillVariant, TaskSkill } from "@/types/skills";
import { SkillAppearanceDialog } from "../-components/skill-appearance-dialog";
import { SkillHeaderActions } from "../-components/skill-header-actions";
import { useSkillMutations } from "../-utils/use-skill-mutations";
import { useSkillSettingsMutation } from "../-utils/use-skill-settings";

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
	projectName,
}: {
	skill: TaskSkill;
	variants: SkillVariant[];
	projectName?: string;
}) {
	const navigate = useNavigate();
	const paneRef = useRef<DocEditorPaneHandle>(null);

	const reading = useReadingModeStore((s) => s.reading);
	const setReading = useReadingModeStore((s) => s.setReading);
	const [editingLabel, setEditingLabel] = useState(false);
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const [confirmingStandardize, setConfirmingStandardize] = useState(false);
	const [confirmingReplicate, setConfirmingReplicate] = useState(false);
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
		standardize,
		standardizing,
		replicate,
		replicating,
		removeSkill,
		removeAllSkill,
		removing,
	} = useSkillMutations();

	useEffect(() => () => setReading(false), [setReading]);

	const activeVariant =
		variants.find((variant) => variant.path === activeVariantPath) ?? variants[0];
	const hasConflict = new Set(variants.map((variant) => variant.group)).size > 1;

	const [description, setDescription] = useState(activeVariant?.description ?? skill.description);
	const [metadata, setMetadata] = useState<Record<string, unknown>>(activeVariant?.metadata ?? {});

	// Se a variante ativa some (ex.: removeu só esta cópia), cai pra primeira restante. Troca o path
	// → remonta o editor com o conteúdo certo e dispara o reset da descrição abaixo.
	useEffect(() => {
		if (variants.length > 0 && !variants.some((variant) => variant.path === activeVariantPath)) {
			setActiveVariantPath(variants[0].path);
		}
	}, [variants, activeVariantPath]);

	// Reseta descrição e metadados só ao trocar de variante (ou de slug, via remount do parent).
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset intencional só por variante.
	useEffect(() => {
		setDescription(activeVariant?.description ?? "");
		setMetadata(activeVariant?.metadata ?? {});
	}, [activeVariantPath]);

	// `skills.update` reescreve o arquivo da VARIANTE ATIVA: os três gatilhos (descrição, corpo,
	// metadados) sempre enviam o trio completo. Descrição e metadados vêm do estado local; o corpo,
	// ao vivo do editor. Assim um switch de metadado não atropela uma edição de texto pendente.
	function persist(next: {
		description: string;
		content: string;
		metadata: Record<string, unknown>;
	}) {
		return updateContent({
			path: activeVariantPath,
			description: next.description,
			content: next.content,
			metadata: next.metadata,
		});
	}

	function changeMetadata(next: Record<string, unknown>) {
		setMetadata(next);
		void persist({
			description,
			content: paneRef.current?.getContent() ?? activeVariant?.content ?? "",
			metadata: next,
		});
	}

	function saveDescription() {
		if (description === activeVariant?.description) return;
		void persist({
			description,
			content: paneRef.current?.getContent() ?? activeVariant?.content ?? "",
			metadata,
		});
	}

	// Colar um SKILL.md completo: o `name` vem do slug ao gravar, então descartamos. A descrição
	// colada vira a descrição da skill; o restante do frontmatter substitui os metadados; o corpo
	// recém-inserido no editor é o conteúdo. Persistimos o trio de uma vez pra não depender do estado
	// desta renderização.
	function applyPastedFrontmatter(frontmatter: Record<string, unknown>, body: string) {
		const { name: _name, description: pastedDesc, ...pastedMeta } = frontmatter;
		const nextDescription = typeof pastedDesc === "string" ? pastedDesc : description;

		setDescription(nextDescription);
		setMetadata(pastedMeta);
		void persist({ description: nextDescription, content: body, metadata: pastedMeta });
		toast.success("Metadados aplicados do arquivo colado");
	}

	function saveLabel(value: string) {
		const next = value.trim();
		setEditingLabel(false);
		if (!next || next === skill.label) return;
		settingsMutation.mutate({ slug: skill.slug, label: next });
	}

	async function selectVariant(path: string) {
		if (path === activeVariantPath) return;
		await paneRef.current?.flush();
		setActiveVariantPath(path);
	}

	// Pasta da variante ativa (absoluta) — alvo de "abrir no SO" e do zip "exportar pasta da skill".
	const skillDir = activeVariant?.dir ?? skill.primaryDir;

	async function copySkillZip() {
		await paneRef.current?.flush();
		await shareFolderAsZip(skillDir);
	}

	const multiSource = skill.sources.length > 1;

	function deleteActiveCopy() {
		setConfirmingDelete(false);
		removeSkill(activeVariantPath);
		// Última (ou única) cópia → a skill some de vez; senão fica nas fontes restantes.
		if (!multiSource) navigate({ to: "/skills" });
	}

	function deleteEverywhere() {
		setConfirmingDelete(false);
		removeAllSkill({ slug: skill.slug, projectName });
		navigate({ to: "/skills" });
	}

	function confirmStandardize() {
		standardize({ slug: skill.slug, projectName, sourcePath: activeVariantPath });
		setConfirmingStandardize(false);
	}

	function changeCategory(categoryId: string | null) {
		if (categoryId === skill.categoryId) return;
		settingsMutation.mutate({ slug: skill.slug, categoryId });
	}

	function confirmReplicate() {
		replicate({ slug: skill.slug, projectName });
		setConfirmingReplicate(false);
	}

	const closeActions = () => setActionsOpen(false);

	return (
		<div className="relative flex h-full w-full flex-col">
			{reading ? null : (
				<>
					<div className="w-full border-b border-border">
						<div className="mx-auto flex h-10 w-full max-w-6xl items-center gap-2 px-2">
							<Link
								to="/skills"
								className="flex items-center px-2 text-muted-foreground transition-colors hover:text-foreground"
								aria-label="Voltar para skills"
							>
								<ArrowLeft size={16} />
							</Link>
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
								{hasConflict && (
									<Chip size="xs" variant="destructive" className="gap-1">
										<TriangleAlert className="size-3" />
										conflito
									</Chip>
								)}
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
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => void paneRef.current?.copyContent()}
									title="Copiar conteúdo"
								>
									<ClipboardCopy className="size-3.5" />
									Copiar
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => setConfirmingReplicate(true)}
									disabled={replicating}
									title="Replicar em todos os ambientes"
								>
									<CopyPlus className="size-3.5" />
									Replicar
								</Button>
								<SkillHeaderActions
									metadata={metadata}
									pinned={pinned}
									onMetadataChange={changeMetadata}
									onAppearance={() => setAppearanceOpen(true)}
									onTogglePin={togglePin}
									onReading={() => setReading(true)}
									onCollapse={() => paneRef.current?.collapseAll()}
									onExpand={() => paneRef.current?.expandAll()}
									onCopyPath={() => void paneRef.current?.copyPath()}
									onOpenInOs={() => void openFolderInOs(skillDir)}
									onShareZip={() => void copySkillZip()}
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
							icon={<CopyPlus className="size-[18px]" />}
							label="Replicar em todos os ambientes"
							onClick={() => {
								setConfirmingReplicate(true);
								closeActions();
							}}
							disabled={replicating}
						/>
						<DocSheetActionButton
							icon={<SlidersHorizontal className="size-[18px]" />}
							label="Aparência"
							onClick={() => {
								setAppearanceOpen(true);
								closeActions();
							}}
						/>
						<DocSheetDivider />
						<DocToolbar
							onCollapse={() => paneRef.current?.collapseAll()}
							onExpand={() => paneRef.current?.expandAll()}
							onCopyContent={() => void paneRef.current?.copyContent()}
							onCopyPath={() => void paneRef.current?.copyPath()}
							onReading={() => setReading(true)}
							pinned={pinned}
							onTogglePin={togglePin}
							share={{
								onOpenInOs: () => void openFolderInOs(skillDir),
								onCopyZip: () => void copySkillZip(),
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

					<div className="w-full border-b border-border">
						<div className="mx-auto w-full max-w-6xl px-2 py-1.5">
							<Textarea
								value={description}
								onChange={(event) => setDescription(event.target.value)}
								onBlur={saveDescription}
								placeholder="Descrição da skill"
								rows={1}
								className="min-h-0 max-h-32 resize-none border-0 bg-transparent px-2 py-1 text-sm leading-relaxed shadow-none field-sizing-content focus-visible:ring-0"
							/>
						</div>
					</div>

					{/* Variantes divergentes: uma tab por cópia (visual das tabs de /tarefas, sem DnD). O
					    ponto colorido agrupa as idênticas; "Padronizar" sobrescreve as outras com a ativa. */}
					{hasConflict && (
						<div className="w-full border-b border-border">
							<div className="mx-auto flex h-8 w-full max-w-6xl items-stretch">
								<div className="flex min-w-0 flex-1 items-stretch">
									{variants.map((variant) => {
										const isActive = variant.path === activeVariantPath;
										return (
											<button
												key={variant.path}
												type="button"
												onClick={() => void selectVariant(variant.path)}
												className={cn(
													"flex h-full items-center justify-center gap-1.5 border-l border-border px-3 text-xs transition-colors",
													isActive
														? "bg-secondary text-foreground"
														: "text-muted-foreground hover:bg-secondary/50",
												)}
												title={variant.path}
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
								<button
									type="button"
									onClick={() => setConfirmingStandardize(true)}
									disabled={standardizing}
									className="flex shrink-0 items-center gap-1.5 border-l border-border px-3 text-xs text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground disabled:opacity-50"
									title="Sobrescrever as outras cópias com esta versão"
								>
									<Check size={14} />
									Definir como principal
								</button>
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
					sessionKey={docSessionKey({ kind: "skill", variantPath: activeVariantPath })}
					content={activeVariant?.content ?? skill.instructions}
					folderPath={activeVariant?.dir ?? skill.primaryDir}
					writeFile={({ content }) => persist({ description, content, metadata })}
					onPasteFrontmatter={applyPastedFrontmatter}
					reading={reading}
					onExitReading={() => setReading(false)}
					onExit={() => navigate({ to: "/skills" })}
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
						: `A pasta de “${skill.label}” será apagada permanentemente do disco.`
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
									onClick={deleteActiveCopy}
									disabled={removing}
									className="text-destructive"
								>
									Só esta cópia ({activeVariant ? SKILL_TOOL_LABEL[activeVariant.tool] : ""}
									{activeVariant ? scopeSuffix(activeVariant.scope) : ""})
								</Button>
								<Button
									variant="destructive"
									size="sm"
									onClick={deleteEverywhere}
									disabled={removing}
								>
									Todas as {skill.sources.length} fontes
								</Button>
							</>
						) : (
							<Button
								variant="destructive"
								size="sm"
								onClick={deleteActiveCopy}
								disabled={removing}
							>
								Remover
							</Button>
						)}
					</div>
				}
			>
				<Text size="sm" tone="muted">
					{multiSource
						? "“Só esta cópia” remove apenas a pasta da fonte selecionada; “todas as fontes” apaga a skill de todos os lugares."
						: "Esta ação não pode ser desfeita."}
				</Text>
			</Dialog>

			<SkillAppearanceDialog
				skill={appearanceOpen ? skill : null}
				onClose={() => setAppearanceOpen(false)}
			/>

			<ConfirmDialog
				open={confirmingStandardize}
				onClose={() => setConfirmingStandardize(false)}
				onConfirm={confirmStandardize}
				title="Padronizar variantes"
				description={`A versão de “${activeVariant ? SKILL_TOOL_LABEL[activeVariant.tool] : ""}${activeVariant ? scopeSuffix(activeVariant.scope) : ""}” será gravada por cima das outras ${variants.length - 1} cópias no disco. As versões divergentes serão perdidas.`}
				confirmLabel="Padronizar"
				variant="danger"
				loading={standardizing}
			/>

			<ConfirmDialog
				open={confirmingReplicate}
				onClose={() => setConfirmingReplicate(false)}
				onConfirm={confirmReplicate}
				title="Replicar em todos os ambientes"
				description={`“${skill.label}” será copiada para opencode, Claude Code, Codex e Agents, sobrescrevendo cópias divergentes com a versão principal.`}
				confirmLabel="Replicar"
				loading={replicating}
			/>
		</div>
	);
}
