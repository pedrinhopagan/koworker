import { ArrowLeft, CornerDownLeft, Link2, Loader2, Plus, Search } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

import { CategorySelect } from "@/components/tasks/CategorySelect";
import { PrioritySelect } from "@/components/tasks/PrioritySelect";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import {
	customSelectContentVariants,
	customSelectItemVariants,
} from "@/components/ui/custom-select";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type TaskOption = { id: string; displayTitle: string };

export type NewTaskPayload = { title: string; categoryId: string; priorityId: string };

// Seletor de tarefa por busca: digita pra filtrar, clica pra arquivar os arquivos na pasta dela.
// Com um único arquivo, oferece renomear no mesmo passo; com vários, mantém os nomes. Sempre dá
// pra criar uma tarefa nova de destino (título + categoria + prioridade) sem sair do popover.
export function LinkTaskPopover({
	tasks,
	loading,
	fileNames,
	pending,
	allowRename = true,
	verb = "arquivar",
	onConfirm,
	onConfirmNew,
	children,
}: {
	tasks: TaskOption[];
	loading: boolean;
	fileNames: string[];
	pending: boolean;
	allowRename?: boolean;
	verb?: string;
	onConfirm: (taskId: string, targetName?: string) => void;
	onConfirmNew?: (payload: NewTaskPayload, targetName?: string) => void;
	children: ReactNode;
}) {
	const [open, setOpen] = useState(false);
	const [mode, setMode] = useState<"pick" | "create">("pick");
	const [query, setQuery] = useState("");
	const single = allowRename && fileNames.length === 1 ? fileNames[0] : null;
	const [renameTo, setRenameTo] = useState(single ?? "");

	const [newTitle, setNewTitle] = useState("");
	const [newCategoryId, setNewCategoryId] = useState<string | null>(null);
	const [newPriorityId, setNewPriorityId] = useState<string | null>(null);

	const filtered = useMemo(() => {
		const term = query.trim().toLowerCase();
		if (!term) return tasks;
		return tasks.filter((task) => task.displayTitle.toLowerCase().includes(term));
	}, [tasks, query]);

	function resetState() {
		setMode("pick");
		setQuery("");
		setRenameTo(single ?? "");
		setNewTitle("");
		setNewCategoryId(null);
		setNewPriorityId(null);
	}

	function handleOpenChange(next: boolean) {
		setOpen(next);
		if (next) resetState();
	}

	// Renome ao arquivar só vale com um único arquivo cujo nome o usuário trocou.
	function targetName(): string | undefined {
		return single && renameTo.trim() !== single ? renameTo.trim() : undefined;
	}

	function pick(taskId: string) {
		onConfirm(taskId, targetName());
		setOpen(false);
	}

	function createAndConfirm() {
		if (!onConfirmNew || !newTitle.trim() || !newCategoryId || !newPriorityId) return;
		onConfirmNew(
			{ title: newTitle.trim(), categoryId: newCategoryId, priorityId: newPriorityId },
			targetName(),
		);
		setOpen(false);
	}

	const canCreate = Boolean(newTitle.trim() && newCategoryId && newPriorityId);

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>{children}</PopoverTrigger>
			<PopoverContent
				align="end"
				sideOffset={6}
				className={cn(customSelectContentVariants(), "w-80 p-0")}
			>
				{mode === "create" ? (
					<div className="flex flex-col gap-3 p-3">
						<button
							type="button"
							onClick={() => setMode("pick")}
							className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
						>
							<ArrowLeft className="size-3.5" />
							Voltar para a busca
						</button>

						<Input
							autoFocus
							value={newTitle}
							onChange={(e) => setNewTitle(e.target.value)}
							placeholder="Título da tarefa"
							className="h-8 text-xs"
							aria-label="Título da nova tarefa"
						/>
						{single && (
							<Input
								value={renameTo}
								onChange={(e) => setRenameTo(e.target.value)}
								placeholder="nome-ao-arquivar.md"
								className="h-8 font-mono text-xs"
								aria-label="Renomear ao arquivar"
							/>
						)}
						<CategorySelect
							value={newCategoryId}
							onValueChange={(id) => setNewCategoryId(id)}
							disabled={pending}
						/>
						<PrioritySelect
							value={newPriorityId}
							onValueChange={(id) => setNewPriorityId(id)}
							disabled={pending}
						/>
						<Button size="sm" disabled={!canCreate || pending} onClick={createAndConfirm}>
							{pending ? (
								<Loader2 className="size-3.5 animate-spin" />
							) : (
								<Plus className="size-3.5" />
							)}
							Criar e {verb}
						</Button>
					</div>
				) : (
					<>
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
							{onConfirmNew && (
								<button
									type="button"
									disabled={pending}
									onClick={() => setMode("create")}
									className={cn(
										customSelectItemVariants(),
										"group flex w-full items-center gap-2 rounded-sm font-medium",
									)}
								>
									<Plus className="size-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
									<span className="min-w-0 flex-1 truncate text-left">Criar nova tarefa</span>
								</button>
							)}
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
									? `${verb} “${fileNames[0]}”`
									: `${verb} ${fileNames.length} arquivos`}
							</Text>
						</div>
					</>
				)}
			</PopoverContent>
		</Popover>
	);
}
