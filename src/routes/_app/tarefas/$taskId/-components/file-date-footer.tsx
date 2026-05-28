import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dateTimeLocalToMs, formatDateTime, toDateTimeLocalValue } from "@/lib/relative-time";
import type { TaskFile } from "@/types/tasks";

type FileDateFooterProps = {
	taskId: string;
	file: TaskFile;
	onChanged: () => void;
};

// Rodapé com criação (birthtime, imutável) e atualização (mtime) do arquivo ativo. A atualização
// é editável: regravá-la (via utimes no backend) reordena a recência na lista e nas abas sem tocar
// no conteúdo — o jeito de jogar pra trás arquivos que não interessam.
export function FileDateFooter({ taskId, file, onChanged }: FileDateFooterProps) {
	const [open, setOpen] = useState(false);
	const [value, setValue] = useState("");

	const setDateMutation = useMutation({
		...orpc.tasks.setFileDate.mutationOptions(),
		onSuccess: () => {
			onChanged();
			setOpen(false);
			toast.success("Data de atualização alterada");
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao alterar a data"),
	});

	function handleOpenChange(next: boolean) {
		if (next) {
			setValue(toDateTimeLocalValue(file.editedAt));
		}
		setOpen(next);
	}

	function save() {
		const ms = dateTimeLocalToMs(value);
		if (Number.isNaN(ms)) {
			toast.error("Data inválida");
			return;
		}
		setDateMutation.mutate({ id: taskId, name: file.name, editedAt: ms });
	}

	return (
		<div className="flex h-8 w-full shrink-0 items-center justify-between border-t border-border px-3 text-muted-foreground text-xs">
			<span>Criado {formatDateTime(file.createdAt)}</span>

			<Popover open={open} onOpenChange={handleOpenChange}>
				<PopoverTrigger asChild>
					<button
						type="button"
						className="rounded-sm px-1.5 py-0.5 tabular-nums transition-colors hover:bg-secondary hover:text-foreground"
						title="Alterar a data de atualização para reordenar a recência"
					>
						Atualizado {formatDateTime(file.editedAt)}
					</button>
				</PopoverTrigger>
				<PopoverContent align="end" className="flex w-auto flex-col gap-2 p-3">
					<Text size="xs" tone="muted">
						Data de atualização
					</Text>
					<Input
						type="datetime-local"
						value={value}
						onChange={(e) => setValue(e.target.value)}
						className="w-auto"
					/>
					<Button size="sm" onClick={save} disabled={setDateMutation.isPending}>
						Salvar
					</Button>
				</PopoverContent>
			</Popover>
		</div>
	);
}
