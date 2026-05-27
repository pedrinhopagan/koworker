import { useQuery } from "@tanstack/react-query";
import { ChevronDown, PencilLine } from "lucide-react";
import { useRef, useState } from "react";

import { orpc } from "@/client";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import { DeleteConfirmButton } from "@/components/ui/delete-confirm-button";
import { cn } from "@/lib/utils";

// Seletor do conteúdo do dropdown (Radix Portal). Cliques aqui não contam como "clique
// fora" da task: o popover vive fora da árvore do item.
export const TASK_SELECT_CONTENT_SELECTOR = "[data-slot='custom-select-content']";

type ColoredItem = { id: string; name: string; color: string };

// Selo de cor + nome. Editável (CustomSelect com borda e chevron) quando `interactive`;
// caso contrário um texto estático, sem moldura de select, que deixa o clique atravessar
// para o link/area da task.
function MetaSelect({
	items,
	value,
	placeholder,
	interactive,
	onValueChange,
}: {
	items: ColoredItem[];
	value: string;
	placeholder: string;
	interactive: boolean;
	onValueChange: (value: string) => void;
}) {
	const selected = items.find((item) => item.id === value) ?? null;

	if (!interactive) {
		return (
			<div className="pointer-events-none flex w-32 shrink-0 items-center gap-1.5 px-2 text-muted-foreground">
				<span
					className="size-2 shrink-0 rounded-full"
					style={{ backgroundColor: selected?.color ?? "#6b7280" }}
				/>
				<span className="truncate text-xs">{selected?.name ?? placeholder}</span>
			</div>
		);
	}

	return (
		<div className="pointer-events-auto w-32 shrink-0">
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

// Cluster da direita compartilhado entre o item da lista e o header da rota dedicada:
// selects de categoria/prioridade (clicáveis só em edição), lápis (toggle do modo) e
// excluir. Apresentacional: o parent é dono das mutations e do que fazer ao excluir.
export function TaskMetaControls({
	categoryId,
	priorityId,
	editing,
	disabled,
	onToggleEdit,
	onCategoryChange,
	onPriorityChange,
	onDelete,
}: {
	categoryId: string;
	priorityId: string;
	editing: boolean;
	disabled: boolean;
	onToggleEdit: () => void;
	onCategoryChange: (categoryId: string) => void;
	onPriorityChange: (priorityId: string) => void;
	onDelete: () => void;
}) {
	const categoriesQuery = useQuery(orpc.categories.list.queryOptions());
	const prioritiesQuery = useQuery(orpc.priorities.list.queryOptions());

	return (
		<div className="pointer-events-none relative z-10 flex shrink-0 items-center gap-2">
			<MetaSelect
				items={categoriesQuery.data ?? []}
				value={categoryId}
				placeholder="Categoria"
				interactive={editing}
				onValueChange={onCategoryChange}
			/>
			<MetaSelect
				items={prioritiesQuery.data ?? []}
				value={priorityId}
				placeholder="Prioridade"
				interactive={editing}
				onValueChange={onPriorityChange}
			/>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				onClick={onToggleEdit}
				disabled={disabled}
				title={editing ? "Concluir edição" : "Editar tarefa"}
				aria-label={editing ? "Concluir edição" : "Editar tarefa"}
				aria-pressed={editing}
				className={cn(
					"pointer-events-auto h-6 w-6 min-h-6 min-w-6 p-0 text-muted-foreground hover:text-foreground",
					editing && "text-foreground",
				)}
			>
				<PencilLine className="h-3 w-3" />
			</Button>
			<DeleteConfirmButton
				className="pointer-events-auto"
				onDelete={onDelete}
				disabled={disabled}
				sizeVariant="xs"
				title="Excluir tarefa"
				confirmTitle="Clique de novo para excluir"
			/>
		</div>
	);
}
