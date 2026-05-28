import { ArrowUpRight, Check, FileText, FolderOpen, Maximize2 } from "lucide-react";

import { Text } from "@/components/typography";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

type LooseFile = { name: string; title: string; content: string };
type TaskGroup = { taskId: string; displayTitle: string; fileNames: string[] };

function SectionLabel({ children, count }: { children: string; count: number }) {
	return (
		<div className="flex items-center gap-2 pb-3">
			<Text size="xs" tone="muted" className="uppercase tracking-[0.14em]">
				{children}
			</Text>
			<span className="h-px flex-1 bg-border" />
			<Text size="xs" tone="muted" className="font-mono tabular-nums">
				{count}
			</Text>
		</div>
	);
}

// Browse do vault: notas soltas em cima (clicar prioriza a seleção pra organizar em lote; um
// botão dedicado abre a nota na rota própria) e abaixo os `.md` já arrumados dentro de cada
// tarefa — só referência, com atalho pra abrir a tarefa dedicada.
export function VaultBrowser({
	loose,
	taskGroups,
	selected,
	onToggleSelect,
	onOpen,
	onNavigateTask,
}: {
	loose: LooseFile[];
	taskGroups: TaskGroup[];
	selected: Set<string>;
	onToggleSelect: (name: string) => void;
	onOpen: (name: string) => void;
	onNavigateTask: (taskId: string) => void;
}) {
	const hasSelection = selected.size > 0;

	return (
		<div className="flex flex-col gap-8 pb-24">
			<section>
				<SectionLabel count={loose.length}>Soltas</SectionLabel>
				{loose.length === 0 ? (
					<Text size="sm" tone="muted">
						Nenhuma nota solta — tudo já está arrumado dentro de uma tarefa.
					</Text>
				) : (
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{loose.map((file, index) => {
							const isSelected = selected.has(file.name);
							return (
								<div
									key={file.name}
									className={cn(
										"group relative flex flex-col border bg-card transition-colors",
										"animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both",
										isSelected
											? "border-primary ring-1 ring-primary"
											: "border-border hover:bg-secondary/60",
									)}
									style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
								>
									<button
										type="button"
										onClick={() => onToggleSelect(file.name)}
										aria-label={isSelected ? "Desmarcar" : "Selecionar"}
										aria-pressed={isSelected}
										className="flex flex-1 cursor-pointer flex-col gap-2 p-4 pr-10 pl-10 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									>
										<div className="flex items-center gap-2">
											<FileText className="size-4 shrink-0 text-muted-foreground" />
											<span className="min-w-0 flex-1 truncate font-display text-sm font-semibold">
												{file.title}
											</span>
										</div>
										<span className="truncate font-mono text-[11px] text-muted-foreground">
											{file.name}
										</span>
									</button>

									<span
										aria-hidden="true"
										className={cn(
											"pointer-events-none absolute left-3 top-4 flex size-4 items-center justify-center rounded-sm border transition-all",
											isSelected
												? "border-primary bg-primary text-primary-foreground"
												: "border-input opacity-0 group-hover:opacity-100",
											hasSelection && "opacity-100",
										)}
									>
										{isSelected && <Check size={11} strokeWidth={3} />}
									</span>

									<button
										type="button"
										onClick={() => onOpen(file.name)}
										aria-label={`Abrir ${file.title}`}
										title="Abrir nota"
										className="absolute right-2 top-3 flex size-6 items-center justify-center text-muted-foreground opacity-0 transition-all hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
									>
										<Maximize2 className="size-3.5" />
									</button>
								</div>
							);
						})}
					</div>
				)}
			</section>

			{taskGroups.length > 0 && (
				<section>
					<SectionLabel count={taskGroups.length}>Em tarefas</SectionLabel>
					<div className="flex flex-col gap-4">
						{taskGroups.map((group) => (
							<div key={group.taskId} className="border border-border bg-card">
								<button
									type="button"
									onClick={() => onNavigateTask(group.taskId)}
									className="flex w-full items-center gap-2 border-b border-border px-4 py-2.5 text-left transition-colors hover:bg-secondary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								>
									<FolderOpen className="size-4 shrink-0 text-muted-foreground" />
									<span className="min-w-0 flex-1 truncate font-display text-sm font-semibold">
										{group.displayTitle}
									</span>
									<Chip size="xs" variant="ghost">
										{group.fileNames.length}
									</Chip>
									<ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
								</button>
								<div className="flex flex-col">
									{group.fileNames.map((name) => (
										<button
											key={name}
											type="button"
											onClick={() => onNavigateTask(group.taskId)}
											className="flex items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-secondary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										>
											<FileText className="size-3.5 shrink-0 text-muted-foreground/70" />
											<span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
												{name}
											</span>
										</button>
									))}
								</div>
							</div>
						))}
					</div>
				</section>
			)}
		</div>
	);
}
