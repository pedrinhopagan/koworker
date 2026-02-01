import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { orpc } from "@/client";
import { Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import { Input } from "@/components/ui/input";
import { ManageDrawer } from "@/components/ui/manage-drawer";
import {
	DragHandle,
	type SortableItemRenderProps,
	SortableList,
} from "@/components/ui/sortable-list";
import { cn } from "@/lib/utils";

type PriorityItem = {
	id: string;
	name: string;
	color: string;
	level: number;
	displayOrder: number;
	createdAt: number;
	updatedAt: number | undefined;
};

export function PriorityManagerDrawer() {
	const queryClient = useQueryClient();
	const prioritiesQueryOptions = orpc.priorities.list.queryOptions();
	const prioritiesQuery = useQuery(prioritiesQueryOptions);
	const priorities = (prioritiesQuery.data ?? []) as PriorityItem[];
	const prioritiesQueryKey = prioritiesQueryOptions.queryKey;

	const [newName, setNewName] = useState("");
	const [newColor, setNewColor] = useState("#000000");
	const [newLevel, setNewLevel] = useState("1");
	const [deleteTargetById, setDeleteTargetById] = useState<Record<string, string>>({});

	const createMutation = useMutation({
		...orpc.priorities.create.mutationOptions(),
		onSuccess: async () => {
			setNewName("");
			setNewLevel("1");
			await queryClient.invalidateQueries({ queryKey: prioritiesQueryKey });
		},
	});

	const updateMutation = useMutation({
		...orpc.priorities.update.mutationOptions(),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: prioritiesQueryKey });
		},
	});

	const deleteMutation = useMutation({
		...orpc.priorities.delete.mutationOptions(),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: prioritiesQueryKey });
		},
	});

	const hasTasksMutation = useMutation(orpc.priorities.hasAssociatedTasks.mutationOptions());
	const migrateAndDeleteMutation = useMutation({
		...orpc.priorities.migrateAndDelete.mutationOptions(),
		onSuccess: async () => {
			setDeleteTargetById({});
			await queryClient.invalidateQueries({ queryKey: prioritiesQueryKey });
			// tasks can be filtered in multiple places; invalidate by prefix.
			await queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "tasks",
			});
		},
	});

	const invalidateTimeoutRef = useRef<number | null>(null);

	useEffect(() => {
		return () => {
			if (invalidateTimeoutRef.current) window.clearTimeout(invalidateTimeoutRef.current);
		};
	}, []);

	const reorderMutation = useMutation({
		...orpc.priorities.reorder.mutationOptions(),
		onMutate: async ({ orderedIds }) => {
			await queryClient.cancelQueries({ queryKey: prioritiesQueryKey });
			const previous = queryClient.getQueryData(prioritiesQueryKey) as PriorityItem[] | undefined;

			if (previous && previous.length > 0) {
				const byId = new Map(previous.map((p) => [p.id, p] as const));
				const next = orderedIds
					.map((id, index) => {
						const item = byId.get(id);
						return item ? { ...item, displayOrder: index } : null;
					})
					.filter(Boolean) as PriorityItem[];

				queryClient.setQueryData(prioritiesQueryKey, next);
			}

			return { previous };
		},
		onError: (_err, _vars, ctx) => {
			if (ctx?.previous) queryClient.setQueryData(prioritiesQueryKey, ctx.previous);
		},
		onSettled: () => {
			if (invalidateTimeoutRef.current) window.clearTimeout(invalidateTimeoutRef.current);
			invalidateTimeoutRef.current = window.setTimeout(() => {
				queryClient.invalidateQueries({ queryKey: prioritiesQueryKey });
			}, 350);
		},
	});

	const sorted = useMemo(
		() => [...priorities].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
		[priorities],
	);
	const [orderedItems, setOrderedItems] = useState<PriorityItem[]>(sorted);

	useEffect(() => {
		setOrderedItems(sorted);
	}, [sorted]);

	function submitCreate() {
		const name = newName.trim();
		const level = Number.parseInt(newLevel, 10);
		if (!name || Number.isNaN(level) || level < 1) return;
		createMutation.mutate({ name, color: newColor, level });
	}

	function renderItem(item: PriorityItem, props: SortableItemRenderProps) {
		const deleting = deleteMutation.isPending || migrateAndDeleteMutation.isPending;
		return (
			<div
				className={cn(
					"flex items-center gap-2 rounded-md border border-border bg-card px-2 py-2",
					props.isDragging && "opacity-60",
				)}
			>
				<DragHandle
					attributes={props.dragHandleProps.attributes}
					listeners={props.dragHandleProps.listeners}
				/>
				<input
					type="color"
					value={item.color ?? "#000000"}
					onChange={(e) => updateMutation.mutate({ id: item.id, color: e.target.value })}
					className="h-8 w-8 shrink-0 cursor-pointer border border-border bg-transparent"
					aria-label="Cor"
				/>
				<Input
					value={item.name}
					onChange={(e) => updateMutation.mutate({ id: item.id, name: e.target.value })}
					className="h-9"
				/>
				<Input
					type="number"
					min={1}
					value={item.level}
					onChange={(e) => {
						const next = Number.parseInt(e.target.value, 10);
						if (Number.isNaN(next) || next < 1) return;
						updateMutation.mutate({ id: item.id, level: next });
					}}
					className="h-9 w-20"
				/>

				<Button
					variant="ghost"
					size="icon"
					disabled={deleting || sorted.length <= 1}
					onClick={async () => {
						const hasTasks = await hasTasksMutation.mutateAsync({ id: item.id });
						if (!hasTasks) {
							deleteMutation.mutate({ id: item.id });
							return;
						}

						const targetId = deleteTargetById[item.id];
						if (!targetId) return;
						migrateAndDeleteMutation.mutate({ sourceId: item.id, targetId });
					}}
					title={
						sorted.length <= 1 ? "Você precisa ter pelo menos uma prioridade" : "Remover prioridade"
					}
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			</div>
		);
	}

	return (
		<ManageDrawer
			drawerKey="priorities"
			title="Gerenciar prioridades"
			description="Crie, edite, reordene e remova prioridades"
		>
			<div className="space-y-4">
				<div className="space-y-2">
					<Title as="div" size="sm">
						Nova prioridade
					</Title>
					<div className="flex items-center gap-2">
						<input
							type="color"
							value={newColor}
							onChange={(e) => setNewColor(e.target.value)}
							className="h-9 w-9 shrink-0 cursor-pointer border border-border bg-transparent"
							aria-label="Cor"
						/>
						<Input
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
							placeholder="Nome da prioridade"
							onKeyDown={(e) => {
								if (e.key === "Enter") submitCreate();
							}}
						/>
						<Input
							type="number"
							min={1}
							value={newLevel}
							onChange={(e) => setNewLevel(e.target.value)}
							placeholder="Nível"
							className="w-24"
						/>
						<Button onClick={submitCreate} disabled={createMutation.isPending}>
							<Plus className="h-4 w-4" />
							Criar
						</Button>
					</div>
				</div>

				<div className="space-y-2">
					<Title as="div" size="sm">
						Prioridades
					</Title>

					{orderedItems.length === 0 ? (
						<div className="text-sm text-muted-foreground">Nenhuma prioridade cadastrada.</div>
					) : (
						<SortableList
							items={orderedItems}
							onReorder={(items) => {
								setOrderedItems(items as PriorityItem[]);
								reorderMutation.mutate({ orderedIds: items.map((i) => i.id) });
							}}
							renderItem={renderItem}
						/>
					)}

					<div className="mt-3 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
						Se a prioridade tiver tarefas associadas, escolha uma prioridade de destino antes de
						remover.
					</div>

					<div className="mt-2 space-y-2">
						{sorted.map((p) => (
							<div key={p.id} className="flex items-center justify-between gap-2">
								<span className="text-xs text-muted-foreground truncate">{p.name}</span>
								<CustomSelect
									items={sorted
										.filter((x) => x.id !== p.id)
										.map((x) => ({ id: x.id, name: x.name, color: x.color }))}
									value={deleteTargetById[p.id] || undefined}
									onValueChange={(newValue) =>
										setDeleteTargetById((s) => ({ ...s, [p.id]: newValue }))
									}
									label="Destino (se necessário)"
									placeholder="Destino (se necessário)"
									variant="default"
									size="sm"
									triggerClassName="min-w-[220px]"
									renderItem={(item) => (
										<div className="w-full px-3 py-2 flex items-center gap-2 text-sm text-foreground">
											<span
												className="size-2 rounded-full shrink-0"
												style={{ backgroundColor: item.color ?? "#6b7280" }}
											/>
											<span className="truncate">{item.name}</span>
										</div>
									)}
								/>
							</div>
						))}
					</div>
				</div>
			</div>
		</ManageDrawer>
	);
}
