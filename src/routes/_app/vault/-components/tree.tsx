import { useDraggable, useDroppable } from "@dnd-kit/core";
import { ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";
import { type MouseEvent, type ReactNode, useState } from "react";

import { Text } from "@/components/typography";
import { Tooltip } from "@/components/ui/tooltip";
import { LucideIcon } from "@/lib/lucide-icon";
import { relativeTimeFrom } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import type { AgentFolder, SkillFolder, TaskFolder, TreeNode } from "../-utils/build-vault-tree";

const FOLDER_KINDS = new Set([
	"feature",
	"taskFolder",
	"looseFolder",
	"agentFolder",
	"skillFolder",
]);

function isFolder(node: TreeNode): boolean {
	return FOLDER_KINDS.has(node.kind);
}

export type ClickModifiers = { ctrl: boolean; shift: boolean };

type TreeProps = {
	nodes: TreeNode[];
	expanded: Set<string>;
	selectedKeys: Set<string>;
	onToggle: (key: string) => void;
	// Clique num arquivo: o dono decide abrir (clique simples) vs selecionar (Ctrl/Shift). Sempre
	// chamado, mesmo no arquivo inerte — a seleção independe de ter rota de edição.
	onActivateFile: (node: TreeNode, modifiers: ClickModifiers) => void;
	onOpenAgent: (slug: string) => void;
	onOpenSkill: (slug: string) => void;
	// Envolve a linha (gatilho do menu de contexto). Presentation-only: o dono decide as ações.
	// `onOpenChange` avisa a row quando o menu abre/fecha, pra ela silenciar a tooltip enquanto aberto.
	wrapNode?: (node: TreeNode, row: ReactNode, onOpenChange: (open: boolean) => void) => ReactNode;
	// Destino válido do drag-and-drop (pasta de tarefa elegível durante o arraste atual). Liga o
	// `useDroppable` da row e o highlight. Sem arraste/destino inválido → false em tudo.
	canDrop?: (node: TreeNode) => boolean;
	// Acessório irmão do botão da row (ex.: ordenação inline na linha "Tarefas"). Fica fora do
	// botão — botão dentro de botão é inválido.
	renderAccessory?: (node: TreeNode) => ReactNode;
};

export function Tree(props: TreeProps) {
	return (
		<div className="flex flex-col">
			{props.nodes.map((node) => (
				<TreeRow key={node.key} node={node} depth={0} {...props} />
			))}
		</div>
	);
}

function TreeRow({ node, depth, ...props }: TreeProps & { node: TreeNode; depth: number }) {
	const {
		expanded,
		selectedKeys,
		onToggle,
		onActivateFile,
		onOpenAgent,
		onOpenSkill,
		wrapNode,
		canDrop,
	} = props;
	const folder = isFolder(node);
	const open = expanded.has(node.key);
	const selected = selectedKeys.has(node.key);
	// Arquivo de pasta solta não tem rota de edição: clique esquerdo não navega, mas continua
	// selecionável (o dono decide). Botão segue habilitado pro contextmenu (disabled o bloquearia).
	const inert = node.kind === "fileLeaf" && node.entry.origin === "folder";

	// DnD: arquivo arrasta, pasta de tarefa elegível recebe. Sempre chamados (regra dos hooks); o
	// `disabled` decide quem participa. `activationConstraint.distance` (no DndContext) garante que o
	// clique simples ainda selecione/abra sem disparar arraste.
	// Menu de contexto aberto silencia a tooltip da row (senão o Popover da tooltip briga com os
	// submenus do menu e o conteúdo fica piscando ao passar o mouse).
	const [menuOpen, setMenuOpen] = useState(false);
	const draggable = useDraggable({ id: node.key, disabled: node.kind !== "fileLeaf" });
	// Pasta de tarefa fica sempre droppable (registrada antes do arraste, sem risco de medição
	// tardia). O ref vai num wrapper que envolve cabeçalho + filhos, então o drop pega a pasta
	// inteira mesmo expandida. O highlight respeita `canDrop`; drop inválido é no-op no dono.
	const droppable = useDroppable({ id: node.key, disabled: node.kind !== "taskFolder" });
	const dragHandle =
		node.kind === "fileLeaf" ? { ...draggable.listeners, ...draggable.attributes } : {};
	const showDropTarget = droppable.isOver && !!canDrop?.(node);

	function activate(event: MouseEvent) {
		if (folder) {
			onToggle(node.key);
			return;
		}
		if (node.kind === "fileLeaf") {
			onActivateFile(node, { ctrl: event.ctrlKey || event.metaKey, shift: event.shiftKey });
			return;
		}
		if (node.kind === "agentSourceLeaf") {
			onOpenAgent(node.slug);
			return;
		}
		if (node.kind === "skillSourceLeaf") {
			onOpenSkill(node.slug);
		}
	}

	const row = (
		<button
			ref={node.kind === "fileLeaf" ? draggable.setNodeRef : undefined}
			{...dragHandle}
			type="button"
			aria-disabled={inert || undefined}
			aria-expanded={folder ? open : undefined}
			aria-selected={node.kind === "fileLeaf" ? selected : undefined}
			title={node.kind === "fileLeaf" ? node.title : undefined}
			onClick={activate}
			style={{ paddingLeft: depth * 16 + 8 }}
			className={cn(
				"group flex h-8 w-full items-center gap-1.5 pr-2 text-left transition-colors",
				selected ? "bg-primary/15 hover:bg-primary/20" : "hover:bg-secondary/60",
				node.kind === "fileLeaf" && draggable.isDragging && "opacity-40",
				inert && !selected && "cursor-default",
				"focus:outline-none focus-visible:bg-secondary/60 focus-visible:ring-1 focus-visible:ring-ring",
			)}
		>
			<ChevronRight
				className={cn(
					"size-3.5 shrink-0 text-muted-foreground transition-transform",
					folder ? (open ? "rotate-90" : "") : "invisible",
				)}
			/>
			<NodeIcon node={node} open={open} />
			<span
				className={cn(
					"min-w-0 flex-1 truncate text-sm",
					folder ? "font-display font-medium" : "font-mono text-[13px] text-muted-foreground",
				)}
			>
				{node.label}
			</span>
		</button>
	);

	const base = wrapNode ? wrapNode(node, row, setMenuOpen) : row;
	// Tooltip rica em pasta de tarefa (prioridade/categoria/edição), agent e skill (infos básicas).
	const tip =
		node.kind === "taskFolder" ? (
			<TaskFolderTooltip node={node} />
		) : node.kind === "agentFolder" ? (
			<AgentFolderTooltip node={node} />
		) : node.kind === "skillFolder" ? (
			<SkillFolderTooltip node={node} />
		) : null;
	const wrapped = tip ? (
		<Tooltip
			side="top"
			align="start"
			openDelay={600}
			triggerClassName="flex w-full min-w-0"
			label={tip}
			disabled={menuOpen}
		>
			{base}
		</Tooltip>
	) : (
		base
	);
	const accessory = props.renderAccessory?.(node);

	const content = (
		<>
			{accessory ? (
				<div className="flex items-center">
					<div className="min-w-0 flex-1">{wrapped}</div>
					{accessory}
				</div>
			) : (
				wrapped
			)}

			{"children" in node && open && (
				<>
					{node.children.map((child) => (
						<TreeRow key={child.key} node={child} depth={depth + 1} {...props} />
					))}
					{node.kind === "feature" && node.placeholder && node.children.length === 0 && (
						<Text
							size="xs"
							tone="muted"
							className="py-1 font-mono"
							style={{ paddingLeft: (depth + 1) * 16 + 22 }}
						>
							{node.placeholder}
						</Text>
					)}
				</>
			)}
		</>
	);

	// Pasta de tarefa: o droppable embrulha cabeçalho + filhos, então o drop pega a pasta inteira
	// mesmo expandida (e não só a linha do cabeçalho).
	if (node.kind === "taskFolder") {
		return (
			<div
				ref={droppable.setNodeRef}
				className={cn(showDropTarget && "rounded-sm bg-primary/10 ring-1 ring-inset ring-primary")}
			>
				{content}
			</div>
		);
	}

	return content;
}

function MetaRow({ color, label, value }: { color: string | null; label: string; value: string }) {
	return (
		<span className="flex items-center gap-1.5">
			<span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color ?? "#666" }} />
			<span className="text-muted-foreground">{label}</span>
			<span className="text-foreground">{value}</span>
		</span>
	);
}

function TaskFolderTooltip({ node }: { node: TaskFolder }) {
	return (
		<div className="flex flex-col gap-1">
			<span className="flex items-center gap-1.5 font-medium text-foreground">
				<Folder className="size-3.5 shrink-0" />
				Tarefa
			</span>
			<MetaRow color={node.priorityColor} label="Prioridade" value={node.priorityName ?? "—"} />
			<MetaRow color={node.categoryColor} label="Categoria" value={node.categoryName ?? "—"} />
			<span className="text-muted-foreground">Editada {relativeTimeFrom(node.lastEditedAt)}</span>
		</div>
	);
}

function SkillFolderTooltip({ node }: { node: SkillFolder }) {
	return (
		<div className="flex max-w-[260px] flex-col gap-1">
			<span className="flex items-center gap-1.5 font-medium text-foreground">
				<LucideIcon name={node.icon} className="size-3.5 shrink-0" style={{ color: node.color }} />
				Skill
			</span>
			{node.description && <span className="text-muted-foreground">{node.description}</span>}
			<span className="flex items-center gap-1.5">
				<span className="text-muted-foreground">Fontes</span>
				<span className="text-foreground">{node.sourceCount}</span>
			</span>
			{node.conflict && <span className="text-destructive">Há conflito entre fontes</span>}
		</div>
	);
}

function AgentFolderTooltip({ node }: { node: AgentFolder }) {
	return (
		<div className="flex max-w-[260px] flex-col gap-1">
			<span className="flex items-center gap-1.5 font-medium text-foreground">
				<LucideIcon name={node.icon} className="size-3.5 shrink-0" style={{ color: node.color }} />
				Agent
			</span>
			{node.description && <span className="text-muted-foreground">{node.description}</span>}
			<span className="flex items-center gap-1.5">
				<span className="text-muted-foreground">Fontes</span>
				<span className="text-foreground">{node.sourceCount}</span>
			</span>
			{node.conflict && <span className="text-destructive">Há conflito entre fontes</span>}
		</div>
	);
}

function NodeIcon({ node, open }: { node: TreeNode; open: boolean }) {
	if (node.kind === "agentFolder" || node.kind === "skillFolder") {
		return (
			<LucideIcon name={node.icon} className="size-4 shrink-0" style={{ color: node.color }} />
		);
	}
	if (node.kind === "taskFolder") {
		const Icon = open ? FolderOpen : Folder;
		return <Icon className="size-4 shrink-0" style={{ color: node.color }} />;
	}
	if (node.kind === "feature" || node.kind === "looseFolder") {
		const Icon = open ? FolderOpen : Folder;
		return <Icon className="size-4 shrink-0 text-muted-foreground" />;
	}
	return <FileText className="size-4 shrink-0 text-muted-foreground" />;
}
