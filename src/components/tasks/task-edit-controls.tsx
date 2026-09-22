import { Button } from "@/components/ui/button";
import { DeleteConfirmButton } from "@/components/ui/delete-confirm-button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PencilLine } from "lucide-react";
import { useRef, useState } from "react";

export function taskTitlePlaceholder(task: { title?: string; titleFromContent: boolean }): string {
	if (task.title) return "Título da tarefa";
	if (task.titleFromContent) return "Sem título: o texto mostrado é o início do conteúdo";
	return "Sem título: digite para nomear";
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
						"pointer-events-auto size-12 p-0 text-muted-foreground hover:text-foreground md:size-6",
						editing && "text-foreground",
					)}
				>
					<PencilLine className="size-4 md:size-3" />
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
