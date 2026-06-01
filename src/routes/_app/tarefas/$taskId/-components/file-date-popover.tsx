import { useMutation } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dateTimeLocalToMs, formatDateTime, toDateTimeLocalValue } from "@/lib/relative-time";
import type { TaskFile } from "@/types/tasks";

type FileDatePopoverProps = {
	taskId: string;
	file: TaskFile;
	onChanged: () => void;
};

// Datas do arquivo ativo num ícone do header da tarefa: criação (birthtime, imutável) e atualização
// (mtime, editável). Regravar a atualização (utimes no backend) reordena a recência na lista e nas
// abas sem tocar no conteúdo — o jeito de jogar pra trás arquivos que não interessam.
export function FileDatePopover({ taskId, file, onChanged }: FileDatePopoverProps) {
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
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					title="Datas do arquivo"
					aria-label="Datas do arquivo"
					className="h-6 w-6 min-h-6 min-w-6 p-0 text-muted-foreground hover:text-foreground"
				>
					<CalendarClock className="h-3.5 w-3.5" />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="flex w-auto flex-col gap-3 p-3">
				<div className="flex flex-col gap-0.5">
					<Text size="xs" tone="muted">
						Criado
					</Text>
					<Text size="sm" className="tabular-nums">
						{formatDateTime(file.createdAt)}
					</Text>
				</div>

				<div className="flex flex-col gap-1">
					<Text size="xs" tone="muted">
						Data de atualização
					</Text>
					<Input
						type="datetime-local"
						value={value}
						onChange={(e) => setValue(e.target.value)}
						className="w-auto"
					/>
				</div>

				<Button size="sm" onClick={save} disabled={setDateMutation.isPending}>
					Salvar
				</Button>
			</PopoverContent>
		</Popover>
	);
}
