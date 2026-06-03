import { useQuery } from "@tanstack/react-query";
import { CheckCheck, Folders, Loader2, Plus, Sparkles } from "lucide-react";
import { useMemo } from "react";

import { orpc, type RouterOutputs } from "@/client";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { Tooltip } from "@/components/ui/tooltip";
import { relativeTimeFrom } from "@/lib/relative-time";
import { entryKey, type VaultEntry, VaultFileCard } from "./vault-file-card";

export type VaultGroup = RouterOutputs["vault"]["listEntries"]["groups"][number];

type ColoredItem = { id: string; name: string; color: string };

// Atalho "selecionar todos" de um grupo — só no modo organizar. Renderizado como irmão do
// CollapsibleSection (cujo header é um <button>), nunca dentro dele.
function SelectAllButton({ onClick }: { onClick: () => void }) {
	return (
		<Tooltip label="Selecionar todos do grupo">
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				aria-label="Selecionar todos do grupo"
				className="shrink-0 self-start text-muted-foreground"
				onClick={onClick}
			>
				<CheckCheck className="size-4" />
			</Button>
		</Tooltip>
	);
}

// Lookup client-side de cor/nome de categoria/prioridade — os grupos só trazem os ids; cor e nome
// resolvem aqui via categories.list/priorities.list (mesmo padrão de task-meta-controls).
function lookup(items: ColoredItem[], id: string | undefined): ColoredItem | null {
	if (!id) return null;
	return items.find((item) => item.id === id) ?? null;
}

function GroupGrid({
	files,
	onOpen,
	onSelect,
	isSelected,
	onRenameLoose,
	onDeleteLoose,
}: {
	files: VaultEntry[];
	onOpen?: (entry: VaultEntry) => void;
	onSelect?: (entry: VaultEntry) => void;
	isSelected?: (entry: VaultEntry) => boolean;
	onRenameLoose?: (name: string) => void;
	onDeleteLoose?: (name: string) => void;
}) {
	if (files.length === 0) {
		return (
			<Text size="sm" tone="muted" className="px-1 py-2">
				Nenhum arquivo.
			</Text>
		);
	}

	return (
		<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
			{files.map((entry, index) => (
				<VaultFileCard
					key={entryKey(entry)}
					entry={entry}
					index={index}
					selected={isSelected?.(entry)}
					onOpen={onSelect ? undefined : onOpen}
					onSelect={onSelect}
					onRenameLoose={onRenameLoose}
					onDeleteLoose={onDeleteLoose}
				/>
			))}
		</div>
	);
}

// Visão agrupada do vault (modo padrão). Três tipos de bloco em ordem: notas soltas no topo
// (cards simples), pastas soltas como grupo intermediário "quase-tarefa" (mono + ícone, sem acento
// nem chips, ação "transformar em tarefa"), e tarefas com cabeçalho rico (acento por prioridade,
// chips de categoria/prioridade/estado, "N arquivos · editado há X"), recente primeiro.
export function VaultGroupedView({
	entries,
	taskGroups,
	folderGroups,
	collapsed,
	organizing,
	onToggleCollapse,
	onOpen,
	onSelect,
	onSelectGroup,
	isSelected,
	onCreateLoose,
	onRenameLoose,
	onDeleteLoose,
	onAdoptFolder,
	adoptingFolder,
}: {
	entries: VaultEntry[];
	taskGroups: VaultGroup[];
	folderGroups: VaultGroup[];
	collapsed: Set<string>;
	organizing: boolean;
	onToggleCollapse: (key: string) => void;
	onOpen: (entry: VaultEntry) => void;
	onSelect: (entry: VaultEntry) => void;
	onSelectGroup: (entries: VaultEntry[]) => void;
	isSelected: (entry: VaultEntry) => boolean;
	onCreateLoose: () => void;
	onRenameLoose: (name: string) => void;
	onDeleteLoose: (name: string) => void;
	onAdoptFolder: (folderName: string) => void;
	adoptingFolder: string | null;
}) {
	// No modo organizar, o clique seleciona em vez de abrir; passa `onSelect` pros cards e omite
	// `onOpen`. Fora dele, `select` fica undefined e os cards voltam a abrir.
	const select = organizing ? onSelect : undefined;
	const categoriesQuery = useQuery(orpc.categories.list.queryOptions());
	const prioritiesQuery = useQuery(orpc.priorities.list.queryOptions());
	const categories = categoriesQuery.data ?? [];
	const priorities = prioritiesQuery.data ?? [];

	// Arquivos por grupo, ordenados por mtime desc (recente primeiro dentro do grupo).
	const filesByKey = useMemo(() => {
		const map = new Map<string, VaultEntry[]>();
		for (const entry of entries) {
			if (!entry.groupKey) continue;
			const list = map.get(entry.groupKey);
			if (list) {
				list.push(entry);
			} else {
				map.set(entry.groupKey, [entry]);
			}
		}
		for (const list of map.values()) {
			list.sort((a, b) => b.mtime - a.mtime);
		}
		return map;
	}, [entries]);

	const looseFiles = useMemo(
		() => entries.filter((entry) => entry.origin === "loose").sort((a, b) => b.mtime - a.mtime),
		[entries],
	);

	// Tarefas ordenadas pela edição mais recente de qualquer arquivo do grupo (recente primeiro).
	const sortedTaskGroups = useMemo(
		() => [...taskGroups].sort((a, b) => b.lastEditedAt - a.lastEditedAt),
		[taskGroups],
	);

	return (
		<div className="flex flex-col gap-6 pb-24">
			<section className="flex flex-col gap-3">
				<div className="flex items-center gap-2 border-b border-border/60 pb-1">
					{organizing && looseFiles.length > 0 && (
						<SelectAllButton onClick={() => onSelectGroup(looseFiles)} />
					)}
					<Title as="h3" size="sm" className="font-medium">
						Notas soltas
					</Title>
					<Text size="xs" tone="muted">
						{looseFiles.length}
					</Text>
				</div>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
					<button
						type="button"
						onClick={onCreateLoose}
						className="group flex flex-col items-center justify-center gap-2 border border-dashed border-border bg-card/40 p-4 text-muted-foreground transition-colors hover:border-foreground/40 hover:bg-secondary/40 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<Plus className="size-5" />
						<span className="font-display text-sm font-semibold">Nova nota</span>
					</button>
					{looseFiles.map((entry, index) => (
						<VaultFileCard
							key={entryKey(entry)}
							entry={entry}
							index={index}
							selected={isSelected(entry)}
							onOpen={select ? undefined : onOpen}
							onSelect={select}
							onRenameLoose={onRenameLoose}
							onDeleteLoose={onDeleteLoose}
						/>
					))}
				</div>
			</section>

			{folderGroups.map((group) => {
				const key = `folder:${group.key}`;
				const open = !collapsed.has(key);
				const isAdopting = adoptingFolder === group.key;

				// O botão de adotar fica como irmão do CollapsibleSection (cujo trigger é um <button>):
				// um <button> dentro de outro é DOM inválido. O ícone de pasta (span) pode ficar no
				// `actions`.
				return (
					<section key={key} className="flex flex-col">
						<div className="flex items-center gap-2">
							{organizing && (
								<SelectAllButton onClick={() => onSelectGroup(filesByKey.get(group.key) ?? [])} />
							)}
							<div className="min-w-0 flex-1">
								<CollapsibleSection
									variant="compact"
									open={open}
									onOpenChange={() => onToggleCollapse(key)}
									title={group.title}
									titleClassName="font-mono"
									subtitle={`${group.fileCount} arquivo${group.fileCount === 1 ? "" : "s"} · editado ${relativeTimeFrom(group.lastEditedAt)}`}
									actions={<Folders className="size-4 text-muted-foreground" />}
								>
									<GroupGrid
										files={filesByKey.get(group.key) ?? []}
										onSelect={select}
										isSelected={isSelected}
									/>
								</CollapsibleSection>
							</div>
							<Button
								type="button"
								size="sm"
								variant="outline"
								className="shrink-0 self-start"
								disabled={isAdopting}
								onClick={() => onAdoptFolder(group.key)}
							>
								{isAdopting ? (
									<Loader2 className="size-3.5 animate-spin" />
								) : (
									<Sparkles className="size-3.5" />
								)}
								Transformar em tarefa
							</Button>
						</div>
					</section>
				);
			})}

			{sortedTaskGroups.map((group) => {
				const key = `task:${group.key}`;
				const open = !collapsed.has(key);
				const priority = lookup(priorities, group.priorityId);
				const category = lookup(categories, group.categoryId);

				return (
					<section
						key={key}
						className="relative flex items-center gap-2 border-l-2 pl-3"
						style={{ borderColor: priority?.color ?? "transparent" }}
					>
						{organizing && (
							<SelectAllButton onClick={() => onSelectGroup(filesByKey.get(group.key) ?? [])} />
						)}
						<div className="min-w-0 flex-1">
							<CollapsibleSection
								variant="compact"
								open={open}
								onOpenChange={() => onToggleCollapse(key)}
								title={group.title}
								titleClassName="font-display text-base"
								subtitle={`${group.fileCount} arquivo${group.fileCount === 1 ? "" : "s"} · editado ${relativeTimeFrom(group.lastEditedAt)}`}
								actions={
									<div className="flex items-center gap-1.5">
										{category && (
											<Chip
												size="xs"
												shape="rounded"
												className="gap-1 border-transparent"
												style={{ color: category.color }}
											>
												<span
													className="size-1.5 rounded-full"
													style={{ backgroundColor: category.color }}
												/>
												{category.name}
											</Chip>
										)}
										{priority && (
											<Chip
												size="xs"
												shape="rounded"
												className="gap-1 border-transparent"
												style={{ color: priority.color }}
											>
												<span
													className="size-1.5 rounded-full"
													style={{ backgroundColor: priority.color }}
												/>
												{priority.name}
											</Chip>
										)}
										{group.done && (
											<Chip size="xs" shape="rounded" variant="secondary">
												Concluída
											</Chip>
										)}
									</div>
								}
							>
								<GroupGrid
									files={filesByKey.get(group.key) ?? []}
									onOpen={onOpen}
									onSelect={select}
									isSelected={isSelected}
								/>
							</CollapsibleSection>
						</div>
					</section>
				);
			})}
		</div>
	);
}
