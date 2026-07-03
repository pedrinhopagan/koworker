import {
	Check,
	ClipboardCopy,
	FileArchive,
	Flame,
	FolderSymlink,
	Gauge,
	LayoutGrid,
	Pencil,
	Share2,
	Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { tv } from "tailwind-variants";

import { Drawer } from "@/components/ui/drawer";
import {
	COMPLEXITY_COLORS,
	COMPLEXITY_LABELS,
	TASK_COMPLEXITIES,
	type TaskComplexity,
} from "@/constants/complexity";
import { cn } from "@/lib/utils";

import type { TaskMenuActions, TaskMenuData, TaskMenuTarget } from "./task-context-menu";

type SheetView = "main" | "priority" | "category" | "complexity" | "move" | "share";

const actionItem = tv({
	base: "flex min-h-12 w-full items-center gap-3 px-5 py-3 text-base text-foreground transition-colors hover:bg-muted/30",
});

const pickItem = tv({
	base: "flex min-h-12 w-full items-center gap-3 px-5 py-3 text-base transition-colors hover:bg-muted/30",
});

type TaskMobileActionsDrawerProps = {
	open: boolean;
	onClose: () => void;
	target: TaskMenuTarget;
	data: TaskMenuData;
	actions: TaskMenuActions;
	complexity: TaskComplexity;
	onComplexityChange: (complexity: TaskComplexity) => void;
	disabled?: boolean;
};

function ColorPickList({
	items,
	activeId,
	emptyLabel,
	onPick,
}: {
	items: { id: string; name: string; color: string }[];
	activeId?: string | null;
	emptyLabel: string;
	onPick: (id: string) => void;
}) {
	if (items.length === 0) {
		return <p className="px-5 py-3 text-muted-foreground text-sm">{emptyLabel}</p>;
	}

	return (
		<div className="flex flex-col">
			{items.map((item) => {
				const active = item.id === activeId;
				return (
					<button
						key={item.id}
						type="button"
						onClick={() => onPick(item.id)}
						className={pickItem({ class: active ? "font-medium" : undefined })}
					>
						<span
							className="size-2.5 shrink-0 rounded-full"
							style={{ backgroundColor: item.color }}
						/>
						<span className="min-w-0 flex-1 truncate text-left">{item.name}</span>
						{active && <Check className="size-4 shrink-0 text-muted-foreground" />}
					</button>
				);
			})}
		</div>
	);
}

export function TaskMobileActionsDrawer({
	open,
	onClose,
	target,
	data,
	actions,
	complexity,
	onComplexityChange,
	disabled,
}: TaskMobileActionsDrawerProps) {
	const [view, setView] = useState<SheetView>("main");
	const [confirmDelete, setConfirmDelete] = useState(false);

	useEffect(() => {
		if (!open) {
			setView("main");
			setConfirmDelete(false);
		}
	}, [open]);

	function close() {
		setView("main");
		setConfirmDelete(false);
		onClose();
	}

	function runAction(fn: () => void) {
		fn();
		close();
	}

	const viewTitles: Record<SheetView, string> = {
		main: target.label,
		priority: "Prioridade",
		category: "Categoria",
		complexity: "Complexidade",
		move: "Mover para projeto",
		share: "Compartilhar",
	};

	function handleBack() {
		setConfirmDelete(false);
		setView("main");
	}

	return (
		<Drawer
			open={open}
			onClose={close}
			side="right"
			title={view === "main" ? "Ações da tarefa" : viewTitles[view]}
			description={view === "main" ? target.label : undefined}
		>
			{view !== "main" && (
				<button
					type="button"
					onClick={handleBack}
					className="mb-4 text-muted-foreground text-sm hover:text-foreground"
				>
					← Voltar
				</button>
			)}

			{view === "main" && (
				<nav className="-mx-5 flex flex-col">
					<button
						type="button"
						disabled={disabled}
						onClick={() => runAction(() => actions.onRename(target))}
						className={actionItem()}
					>
						<Pencil className="size-[18px] shrink-0" />
						Editar título
					</button>
					<button
						type="button"
						disabled={disabled}
						onClick={() => setView("complexity")}
						className={actionItem()}
					>
						<Gauge className="size-[18px] shrink-0" />
						Complexidade
					</button>
					<button
						type="button"
						disabled={disabled}
						onClick={() => setView("category")}
						className={actionItem()}
					>
						<LayoutGrid className="size-[18px] shrink-0" />
						Categoria
					</button>
					<button
						type="button"
						disabled={disabled}
						onClick={() => setView("priority")}
						className={actionItem()}
					>
						<Flame className="size-[18px] shrink-0" />
						Prioridade
					</button>
					<button
						type="button"
						disabled={disabled}
						onClick={() => setView("move")}
						className={actionItem()}
					>
						<FolderSymlink className="size-[18px] shrink-0" />
						Mover para projeto
					</button>
					<button
						type="button"
						disabled={disabled}
						onClick={() => setView("share")}
						className={actionItem()}
					>
						<Share2 className="size-[18px] shrink-0" />
						Compartilhar
					</button>

					<div className="my-3 border-t border-border" />

					<button
						type="button"
						disabled={disabled}
						onClick={() => {
							if (confirmDelete) {
								runAction(() => actions.onDelete(target));
								return;
							}
							setConfirmDelete(true);
						}}
						className={cn(
							actionItem(),
							"text-destructive hover:bg-destructive/10 hover:text-destructive",
							confirmDelete && "bg-destructive/10",
						)}
					>
						<Trash2 className="size-[18px] shrink-0" />
						{confirmDelete ? "Toque de novo para excluir" : "Excluir tarefa"}
					</button>
				</nav>
			)}

			{view === "priority" && (
				<ColorPickList
					items={data.priorities}
					activeId={target.priorityId}
					emptyLabel="Nenhuma prioridade"
					onPick={(id) => runAction(() => actions.onSetPriority(target, id))}
				/>
			)}

			{view === "category" && (
				<ColorPickList
					items={data.categories}
					activeId={target.categoryId}
					emptyLabel="Nenhuma categoria"
					onPick={(id) => runAction(() => actions.onSetCategory(target, id))}
				/>
			)}

			{view === "complexity" && (
				<div className="flex flex-col">
					{TASK_COMPLEXITIES.map((level) => {
						const active = level === complexity;
						return (
							<button
								key={level}
								type="button"
								onClick={() => runAction(() => onComplexityChange(level))}
								className={pickItem({ class: active ? "font-medium" : undefined })}
							>
								<span
									className="size-2.5 shrink-0 rounded-full"
									style={{ backgroundColor: COMPLEXITY_COLORS[level] }}
								/>
								<span className="min-w-0 flex-1 truncate text-left">
									{COMPLEXITY_LABELS[level]}
								</span>
								{active && <Check className="size-4 shrink-0 text-muted-foreground" />}
							</button>
						);
					})}
				</div>
			)}

			{view === "move" && (
				<ColorPickList
					items={data.projects}
					emptyLabel="Nenhum outro projeto"
					onPick={(id) => runAction(() => actions.onMoveToProject(target, id))}
				/>
			)}

			{view === "share" && (
				<nav className="-mx-5 flex flex-col">
					<button
						type="button"
						onClick={() => runAction(() => actions.onShareContent(target))}
						className={actionItem()}
					>
						<ClipboardCopy className="size-[18px] shrink-0" />
						Copiar conteúdo
					</button>
					<button
						type="button"
						onClick={() => runAction(() => actions.onShareZip(target))}
						className={actionItem()}
					>
						<FileArchive className="size-[18px] shrink-0" />
						Copiar zip
					</button>
				</nav>
			)}
		</Drawer>
	);
}
