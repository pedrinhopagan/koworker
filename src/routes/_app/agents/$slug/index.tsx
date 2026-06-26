import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	Check,
	FolderInput,
	Loader2,
	PencilLine,
	SlidersHorizontal,
	Trash2,
	TriangleAlert,
	X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { DocEditorPane, type DocEditorPaneHandle } from "@/components/doc-editor-pane";
import { DocToolbar } from "@/components/doc-toolbar";
import { TaskTitleInput } from "@/components/tasks/task-meta-controls";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AGENT_TOOL_LABEL } from "@/constants/agents";
import { useAgentQuery } from "@/hooks/use-agents";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { useRecordDocSession } from "@/hooks/use-record-doc-session";
import { LucideIcon } from "@/lib/lucide-icon";
import { cn } from "@/lib/utils";
import { docSessionKey } from "@/stores/doc-sessions";
import { useReadingModeStore } from "@/stores/reading-mode";
import type { AgentVariant, TaskAgent } from "@/types/agents";
import { AgentAppearanceDialog } from "../-components/agent-appearance-dialog";
import { AgentMetadataControls } from "../-components/agent-metadata-controls";
import { useAgentMutations } from "../-utils/use-agent-mutations";
import { useAgentSettingsMutation } from "../-utils/use-agent-settings";

export const Route = createFileRoute("/_app/agents/$slug/")({
	component: AgentPage,
});

function AgentPage() {
	const { slug } = Route.useParams();
	const { selectedProject } = useProjectFocus();

	const agentQuery = useAgentQuery(slug);

	if (agentQuery.isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="flex items-center gap-2 text-muted-foreground">
					<Loader2 size={18} className="animate-spin" />
					<Text size="sm" tone="muted">
						Carregando agent...
					</Text>
				</div>
			</div>
		);
	}

	if (!agentQuery.agent) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4">
				<Text size="sm" tone="muted">
					Agent não encontrado.
				</Text>
				<Button variant="outline" asChild>
					<Link to="/agents">Voltar para agents</Link>
				</Button>
			</div>
		);
	}

	return (
		<AgentEditor
			key={agentQuery.agent.slug}
			agent={agentQuery.agent}
			variants={agentQuery.variants}
			project={selectedProject}
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

function scopeSuffix(scope: AgentVariant["scope"]): string {
	if (scope === "project") return " · projeto";
	if (scope === "custom") return " · custom";
	return "";
}

// Remonta por slug (`key` no parent): navegar agent→agent troca o param sem remontar a rota, e o
// editor markdown só lê `initialContent` no mount — sem o remount o corpo do agent anterior vazaria.
function AgentEditor({
	agent,
	variants,
	project,
}: {
	agent: TaskAgent;
	variants: AgentVariant[];
	project: { name: string; mainRoute: string } | null;
}) {
	const navigate = useNavigate();
	const paneRef = useRef<DocEditorPaneHandle>(null);

	const reading = useReadingModeStore((s) => s.reading);
	const setReading = useReadingModeStore((s) => s.setReading);
	const [editingLabel, setEditingLabel] = useState(false);
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const [confirmingStandardize, setConfirmingStandardize] = useState(false);
	const [appearanceOpen, setAppearanceOpen] = useState(false);
	const [activeVariantPath, setActiveVariantPath] = useState(agent.primaryPath);

	// Agent é global: a sessão não carrega projeto (não troca o projeto selecionado ao abrir pelo
	// switcher) e a chave ignora o projeto, então o mesmo agent grava uma vez só no MRU. Sem subtitle:
	// o slug já é o título, repeti-lo embaixo era ruído.
	const { pinned, togglePin } = useRecordDocSession({
		key: docSessionKey({ kind: "agent", variantPath: activeVariantPath }),
		kind: "agent",
		title: agent.label,
		icon: agent.icon,
		iconColor: agent.color,
		nav: { to: "/agents/$slug", params: { slug: agent.slug } },
	});

	const settingsMutation = useAgentSettingsMutation();
	const {
		updateContent,
		standardize,
		standardizing,
		removeAgent,
		removeAllAgent,
		removing,
		inject,
		injecting,
	} = useAgentMutations();

	useEffect(() => () => setReading(false), [setReading]);

	const activeVariant =
		variants.find((variant) => variant.path === activeVariantPath) ?? variants[0];
	const hasConflict = new Set(variants.map((variant) => variant.group)).size > 1;

	const [description, setDescription] = useState(activeVariant?.description ?? agent.description);
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

	// `agents.update` reescreve o arquivo da VARIANTE ATIVA: os três gatilhos (descrição, corpo,
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

	// Colar um agent.md completo: o `name` vem do slug ao gravar, então descartamos. A descrição
	// colada vira a descrição do agent; o restante do frontmatter substitui os metadados; o corpo
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
		if (!next || next === agent.label) return;
		settingsMutation.mutate({ slug: agent.slug, label: next });
	}

	async function selectVariant(path: string) {
		if (path === activeVariantPath) return;
		await paneRef.current?.flush();
		setActiveVariantPath(path);
	}

	const multiSource = agent.sources.length > 1;

	// Injetar = copiar o agent pros arquivos do projeto focado. Só faz sentido pra agents que não são
	// globais (esses já valem em todo projeto) e que o projeto ainda não tem. O dir-alvo bate exato com
	// a fonte (não `startsWith`): roots de projetos aninham (ex.: um projeto em /home/pedro engloba os
	// de ~/Projects), e prefixo daria falso positivo.
	const injectTargetDir = project ? `${project.mainRoute}/.claude/agents` : null;
	const isGlobal = agent.sources.some((source) => source.scope === "global");
	const alreadyInProject = agent.sources.some((source) => source.path === injectTargetDir);

	function deleteActiveCopy() {
		setConfirmingDelete(false);
		removeAgent(activeVariantPath);
		// Última (ou única) cópia → o agent some de vez; senão fica nas fontes restantes.
		if (!multiSource) navigate({ to: "/agents" });
	}

	function deleteEverywhere() {
		setConfirmingDelete(false);
		removeAllAgent({ slug: agent.slug });
		navigate({ to: "/agents" });
	}

	function confirmStandardize() {
		standardize({ slug: agent.slug, sourcePath: activeVariantPath });
		setConfirmingStandardize(false);
	}

	function injectIntoProject() {
		if (!project) return;
		inject({ sourcePath: agent.primaryPath, projectName: project.name });
	}

	return (
		<div className="relative flex h-full w-full flex-col">
			{reading ? null : (
				<>
					<div className="w-full border-b border-border">
						<div className="mx-auto flex h-10 w-full max-w-6xl items-center gap-2 px-2">
							<Link
								to="/agents"
								className="flex items-center px-2 text-muted-foreground transition-colors hover:text-foreground"
								aria-label="Voltar para agents"
							>
								<ArrowLeft size={16} />
							</Link>
							<div
								className="flex size-6 shrink-0 items-center justify-center border"
								style={{ borderColor: agent.color, color: agent.color }}
							>
								<LucideIcon name={agent.icon} className="size-3.5" />
							</div>
							{editingLabel ? (
								<div className="min-w-0 flex-1">
									<TaskTitleInput
										initialValue={agent.label}
										placeholder={agent.slug}
										onSave={saveLabel}
										onCancel={() => setEditingLabel(false)}
									/>
								</div>
							) : (
								<button
									type="button"
									onClick={() => setEditingLabel(true)}
									className="group flex min-w-0 flex-1 items-center gap-1.5 text-left"
									title="Renomear agent"
								>
									<Text size="sm" className="min-w-0 truncate font-display font-semibold">
										{agent.label}
									</Text>
									<PencilLine className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
								</button>
							)}

							<div className="flex shrink-0 items-center gap-1">
								{agent.sources.map((source) => (
									<Chip key={source.path} size="xs" variant="ghost">
										{AGENT_TOOL_LABEL[source.tool]}
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

							<AgentMetadataControls metadata={metadata} onChange={changeMetadata} />
							{project && !isGlobal && !alreadyInProject && (
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={injectIntoProject}
									disabled={injecting}
									title={`Copiar este agent para ${project.name}/.claude/agents`}
								>
									<FolderInput className="size-3.5" />
									Injetar em {project.name}
								</Button>
							)}
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setAppearanceOpen(true)}
							>
								<SlidersHorizontal className="size-3.5" />
								Aparência
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
							/>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								onClick={() => setConfirmingDelete(true)}
								title="Remover agent"
								aria-label="Remover agent"
								className="h-6 w-6 min-h-6 min-w-6 p-0 text-muted-foreground hover:text-destructive"
							>
								<Trash2 className="size-3.5" />
							</Button>
						</div>
					</div>

					<div className="w-full border-b border-border">
						<div className="mx-auto w-full max-w-6xl px-2 py-1.5">
							<Textarea
								value={description}
								onChange={(event) => setDescription(event.target.value)}
								onBlur={saveDescription}
								placeholder="Descrição do agent"
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
													{AGENT_TOOL_LABEL[variant.tool]}
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
					fileName={`${agent.slug}.md`}
					sessionKey={docSessionKey({ kind: "agent", variantPath: activeVariantPath })}
					content={activeVariant?.content ?? agent.instructions}
					folderPath={activeVariant?.dir ?? agent.primaryDir}
					writeFile={({ content }) => persist({ description, content, metadata })}
					onPasteFrontmatter={applyPastedFrontmatter}
					reading={reading}
					onExitReading={() => setReading(false)}
					onExit={() => navigate({ to: "/agents" })}
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
				title="Remover agent"
				description={
					multiSource
						? `“${agent.label}” existe em ${agent.sources.length} fontes. Escolha o que apagar do disco.`
						: `O arquivo de “${agent.label}” será apagado permanentemente do disco.`
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
									Só esta cópia ({activeVariant ? AGENT_TOOL_LABEL[activeVariant.tool] : ""}
									{activeVariant ? scopeSuffix(activeVariant.scope) : ""})
								</Button>
								<Button
									variant="destructive"
									size="sm"
									onClick={deleteEverywhere}
									disabled={removing}
								>
									Todas as {agent.sources.length} fontes
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
						? "“Só esta cópia” remove apenas o arquivo da fonte selecionada; “todas as fontes” apaga o agent de todos os lugares."
						: "Esta ação não pode ser desfeita."}
				</Text>
			</Dialog>

			<AgentAppearanceDialog
				agent={appearanceOpen ? agent : null}
				onClose={() => setAppearanceOpen(false)}
			/>

			<ConfirmDialog
				open={confirmingStandardize}
				onClose={() => setConfirmingStandardize(false)}
				onConfirm={confirmStandardize}
				title="Padronizar variantes"
				description={`A versão de “${activeVariant ? AGENT_TOOL_LABEL[activeVariant.tool] : ""}${activeVariant ? scopeSuffix(activeVariant.scope) : ""}” será gravada por cima das outras ${variants.length - 1} cópias no disco. As versões divergentes serão perdidas.`}
				confirmLabel="Padronizar"
				variant="danger"
				loading={standardizing}
			/>
		</div>
	);
}
