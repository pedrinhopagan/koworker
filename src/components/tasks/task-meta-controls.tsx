import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Flag, Gauge, type LucideIcon, PencilLine, Tag } from "lucide-react";
import { useRef, useState } from "react";

import { orpc } from "@/client";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import { DeleteConfirmButton } from "@/components/ui/delete-confirm-button";
import { Tooltip } from "@/components/ui/tooltip";
import {
	COMPLEXITY_COLORS,
	COMPLEXITY_LABELS,
	TASK_COMPLEXITIES,
	type TaskComplexity,
} from "@/constants/complexity";
import { cn } from "@/lib/utils";

// Seletor do conteúdo do dropdown (Radix Portal). Cliques aqui não contam como "clique
// fora" da task: o popover vive fora da árvore do item.
export const TASK_SELECT_CONTENT_SELECTOR = "[data-slot='custom-select-content']";

type ColoredItem = { id: string; name: string; color: string };

// Selo de cor + nome. Editável (CustomSelect com borda e chevron) quando `interactive`;
// caso contrário um ícone colorido compacto com tooltip do nome, sem moldura de select nem
// largura fixa, que deixa o clique atravessar para o link/area da task.
function MetaSelect({
	items,
	value,
	placeholder,
	icon: Icon,
	interactive,
	layout = "inline",
	onValueChange,
}: {
	items: ColoredItem[];
	value: string;
	placeholder: string;
	icon: LucideIcon;
	interactive: boolean;
	layout?: "inline" | "stacked";
	onValueChange: (value: string) => void;
}) {
	const selected = items.find((item) => item.id === value) ?? null;
	const widthClass = layout === "stacked" ? "w-full" : "w-32";

	if (!interactive) {
		return (
			<Tooltip label={selected?.name ?? placeholder}>
				<span
					className="pointer-events-auto inline-flex shrink-0 items-center"
					aria-label={selected?.name ?? placeholder}
				>
					<Icon className="size-4 shrink-0" style={{ color: selected?.color ?? "#6b7280" }} />
				</span>
			</Tooltip>
		);
	}

	return (
		<div className={cn("pointer-events-auto shrink-0", widthClass)}>
			<CustomSelect
				items={items}
				value={value}
				onValueChange={onValueChange}
				variant="minimal"
				size="sm"
				triggerClassName="gap-1 border border-border bg-muted/40 px-2 text-muted-foreground hover:border-muted-foreground hover:bg-muted hover:text-foreground"
				renderTrigger={() => (
					<>
						<span className="flex min-w-0 items-center gap-1.5">
							<span
								className="size-2 shrink-0 rounded-full"
								style={{ backgroundColor: selected?.color ?? "#6b7280" }}
							/>
							<span className="truncate text-xs">{selected?.name ?? placeholder}</span>
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

// Placeholder do input de renome. Quando a task não tem título, o nome exibido é só o início do
// 1º .md (titleFromContent) — o placeholder deixa explícito que não é um título de verdade, em vez
// de só repetir o snippet e parecer que já existe um nome.
export function taskTitlePlaceholder(task: { title?: string; titleFromContent: boolean }): string {
	if (task.title) return "Título da tarefa";
	if (task.titleFromContent) return "Sem título — o texto mostrado é o início do conteúdo";
	return "Sem título — digite para nomear";
}

// Input de renome do título. Salva no blur (sem fechar o modo: quem controla é o lápis) e
// cancela no Escape.
export function TaskTitleInput({
	initialValue,
	placeholder,
	onSave,
	onCancel,
}: {
	initialValue: string;
	placeholder: string;
	onSave: (value: string) => void;
	onCancel: () => void;
}) {
	const [value, setValue] = useState(initialValue);
	const cancelled = useRef(false);

	return (
		<input
			// biome-ignore lint/a11y/noAutofocus: o input só monta sob ação explícita do pencil.
			autoFocus
			value={value}
			placeholder={placeholder}
			onChange={(event) => setValue(event.target.value)}
			onFocus={(event) => event.currentTarget.select()}
			onBlur={() => (cancelled.current ? onCancel() : onSave(value))}
			onKeyDown={(event) => {
				if (event.key === "Enter") {
					event.preventDefault();
					event.currentTarget.blur();
				} else if (event.key === "Escape") {
					event.preventDefault();
					cancelled.current = true;
					event.currentTarget.blur();
				}
			}}
			className="w-full min-w-0 flex-1 border-b border-border bg-transparent text-base font-normal tracking-wide outline-none focus:border-ring"
		/>
	);
}

const COMPLEXITY_ITEMS: ColoredItem[] = TASK_COMPLEXITIES.map((c) => ({
	id: c,
	name: COMPLEXITY_LABELS[c],
	color: COMPLEXITY_COLORS[c],
}));

// Os três selects de meta (complexidade/categoria/prioridade) com as queries de categorias e
// prioridades. Sem wrapper próprio: o caller posiciona (linha do header, coluna do drawer). Só é
// editável quando `interactive` — fora disso, ícones coloridos compactos que deixam o clique passar.
export function TaskMetaSelects({
	categoryId,
	priorityId,
	complexity,
	interactive,
	layout = "inline",
	onCategoryChange,
	onPriorityChange,
	onComplexityChange,
}: {
	categoryId: string | null;
	priorityId: string | null;
	complexity: TaskComplexity;
	interactive: boolean;
	layout?: "inline" | "stacked";
	onCategoryChange: (categoryId: string) => void;
	onPriorityChange: (priorityId: string) => void;
	onComplexityChange: (complexity: TaskComplexity) => void;
}) {
	const categoriesQuery = useQuery(orpc.categories.list.queryOptions());
	const prioritiesQuery = useQuery(orpc.priorities.list.queryOptions());

	return (
		<>
			<MetaSelect
				items={COMPLEXITY_ITEMS}
				value={complexity}
				placeholder="Complexidade"
				icon={Gauge}
				interactive={interactive}
				layout={layout}
				onValueChange={(value) => onComplexityChange(value as TaskComplexity)}
			/>
			<MetaSelect
				items={categoriesQuery.data ?? []}
				value={categoryId ?? ""}
				placeholder="Categoria"
				icon={Tag}
				interactive={interactive}
				layout={layout}
				onValueChange={onCategoryChange}
			/>
			<MetaSelect
				items={prioritiesQuery.data ?? []}
				value={priorityId ?? ""}
				placeholder="Prioridade"
				icon={Flag}
				interactive={interactive}
				layout={layout}
				onValueChange={onPriorityChange}
			/>
		</>
	);
}

// Lápis (toggle do modo edição) + excluir. Apresentacional: o parent é dono das mutations e do que
// fazer ao excluir. Sem wrapper próprio, para o caller alinhar na sua barra.
export function TaskEditControls({
	editing,
	disabled,
	onToggleEdit,
	onDelete,
}: {
	editing: boolean;
	disabled: boolean;
	onToggleEdit: () => void;
	onDelete: () => void;
}) {
	return (
		<>
			<Tooltip label={editing ? "Concluir edição" : "Editar tarefa"}>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					onClick={onToggleEdit}
					disabled={disabled}
					aria-label={editing ? "Concluir edição" : "Editar tarefa"}
					aria-pressed={editing}
					className={cn(
						"pointer-events-auto h-6 w-6 min-h-6 min-w-6 p-0 text-muted-foreground hover:text-foreground",
						editing && "text-foreground",
					)}
				>
					<PencilLine className="h-3 w-3" />
				</Button>
			</Tooltip>
			<DeleteConfirmButton
				className="pointer-events-auto"
				onDelete={onDelete}
				disabled={disabled}
				sizeVariant="xs"
				title="Excluir tarefa"
				confirmTitle="Clique de novo para excluir"
			/>
		</>
	);
}

// Cluster da direita compartilhado entre o item da lista e o drawer mobile: selects de meta
// (clicáveis só em edição) + lápis/excluir (só inline). O parent é dono das mutations.
export function TaskMetaControls({
	categoryId,
	priorityId,
	complexity,
	editing,
	disabled,
	layout = "inline",
	className,
	onToggleEdit,
	onCategoryChange,
	onPriorityChange,
	onComplexityChange,
	onDelete,
}: {
	categoryId: string | null;
	priorityId: string | null;
	complexity: TaskComplexity;
	editing: boolean;
	disabled: boolean;
	layout?: "inline" | "stacked";
	className?: string;
	onToggleEdit: () => void;
	onCategoryChange: (categoryId: string) => void;
	onPriorityChange: (priorityId: string) => void;
	onComplexityChange: (complexity: TaskComplexity) => void;
	onDelete: () => void;
}) {
	const stacked = layout === "stacked";

	return (
		<div
			className={cn(
				"pointer-events-none relative z-10 flex shrink-0 gap-2",
				stacked ? "w-full flex-col" : "items-center",
				className,
			)}
		>
			<TaskMetaSelects
				categoryId={categoryId}
				priorityId={priorityId}
				complexity={complexity}
				interactive={editing}
				layout={layout}
				onCategoryChange={onCategoryChange}
				onPriorityChange={onPriorityChange}
				onComplexityChange={onComplexityChange}
			/>
			{!stacked && (
				<TaskEditControls
					editing={editing}
					disabled={disabled}
					onToggleEdit={onToggleEdit}
					onDelete={onDelete}
				/>
			)}
		</div>
	);
}
