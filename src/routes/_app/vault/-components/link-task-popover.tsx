import { CornerDownLeft, Link2, Loader2, Search } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

import { Text } from "@/components/typography";
import {
	customSelectContentVariants,
	customSelectItemVariants,
} from "@/components/ui/custom-select";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type TaskOption = { id: string; displayTitle: string };

// Seletor de tarefa por busca: digita pra filtrar, clica pra arquivar os arquivos na pasta dela.
// Com um único arquivo, oferece renomear no mesmo passo; com vários, mantém os nomes.
export function LinkTaskPopover({
	tasks,
	loading,
	fileNames,
	pending,
	onConfirm,
	children,
}: {
	tasks: TaskOption[];
	loading: boolean;
	fileNames: string[];
	pending: boolean;
	onConfirm: (taskId: string, targetName?: string) => void;
	children: ReactNode;
}) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const single = fileNames.length === 1 ? fileNames[0] : null;
	const [renameTo, setRenameTo] = useState(single ?? "");

	const filtered = useMemo(() => {
		const term = query.trim().toLowerCase();
		if (!term) return tasks;
		return tasks.filter((task) => task.displayTitle.toLowerCase().includes(term));
	}, [tasks, query]);

	function handleOpenChange(next: boolean) {
		setOpen(next);
		if (next) {
			setQuery("");
			setRenameTo(single ?? "");
		}
	}

	function pick(taskId: string) {
		const target = single && renameTo.trim() !== single ? renameTo.trim() : undefined;
		onConfirm(taskId, target);
		setOpen(false);
	}

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>{children}</PopoverTrigger>
			<PopoverContent
				align="end"
				sideOffset={6}
				className={cn(customSelectContentVariants(), "w-80 p-0")}
			>
				<div className="flex flex-col gap-2 border-b border-border p-2">
					<div className="relative">
						<Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
						<Input
							autoFocus
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Buscar tarefa..."
							className="h-8 pl-8 text-xs"
						/>
					</div>
					{single && (
						<Input
							value={renameTo}
							onChange={(e) => setRenameTo(e.target.value)}
							placeholder="nome-ao-arquivar.md"
							className="h-8 font-mono text-xs"
							aria-label="Renomear ao arquivar"
						/>
					)}
				</div>

				<div className="max-h-60 overflow-y-auto p-1">
					{loading ? (
						<div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
							<Loader2 className="size-3.5 animate-spin" />
							Carregando tarefas...
						</div>
					) : filtered.length === 0 ? (
						<div className="px-3 py-2 text-xs text-muted-foreground">
							{tasks.length === 0 ? "Nenhuma tarefa neste projeto" : "Nada corresponde à busca"}
						</div>
					) : (
						filtered.map((task) => (
							<button
								key={task.id}
								type="button"
								disabled={pending}
								onClick={() => pick(task.id)}
								className={cn(
									customSelectItemVariants(),
									"group flex w-full items-center gap-2 rounded-sm",
								)}
							>
								<Link2 className="size-3.5 shrink-0 opacity-40 group-hover:opacity-100" />
								<span className="min-w-0 flex-1 truncate text-left">{task.displayTitle}</span>
								<CornerDownLeft className="size-3 shrink-0 opacity-0 group-hover:opacity-50" />
							</button>
						))
					)}
				</div>

				<div className="border-t border-border px-3 py-1.5">
					<Text size="xs" tone="muted" className="font-mono">
						{fileNames.length === 1
							? `arquivar “${fileNames[0]}”`
							: `arquivar ${fileNames.length} arquivos`}
					</Text>
				</div>
			</PopoverContent>
		</Popover>
	);
}
