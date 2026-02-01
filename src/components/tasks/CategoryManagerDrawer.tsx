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

type CategoryItem = {
	id: string;
	name: string;
	color: string;
	displayOrder: number;
	createdAt: number;
	updatedAt: number | undefined;
};

export function CategoryManagerDrawer() {
	const queryClient = useQueryClient();
	const categoriesQueryOptions = orpc.categories.list.queryOptions();
	const categoriesQuery = useQuery(categoriesQueryOptions);
	const categories = (categoriesQuery.data ?? []) as CategoryItem[];
	const categoriesQueryKey = categoriesQueryOptions.queryKey;

	const [newName, setNewName] = useState("");
	const [newColor, setNewColor] = useState("#000000");
	const [deleteTargetById, setDeleteTargetById] = useState<Record<string, string>>({});

	const createMutation = useMutation({
		...orpc.categories.create.mutationOptions(),
		onSuccess: async () => {
			setNewName("");
			await queryClient.invalidateQueries({ queryKey: categoriesQueryKey });
		},
	});

	const updateMutation = useMutation({
		...orpc.categories.update.mutationOptions(),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: categoriesQueryKey });
		},
	});

	const deleteMutation = useMutation({
		...orpc.categories.delete.mutationOptions(),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: categoriesQueryKey });
		},
	});

	const hasTasksMutation = useMutation(orpc.categories.hasAssociatedTasks.mutationOptions());
	const migrateAndDeleteMutation = useMutation({
		...orpc.categories.migrateAndDelete.mutationOptions(),
		onSuccess: async () => {
			setDeleteTargetById({});
			await queryClient.invalidateQueries({ queryKey: categoriesQueryKey });
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
		...orpc.categories.reorder.mutationOptions(),
		onMutate: async ({ orderedIds }) => {
			await queryClient.cancelQueries({ queryKey: categoriesQueryKey });
			const previous = queryClient.getQueryData(categoriesQueryKey) as CategoryItem[] | undefined;

			if (previous && previous.length > 0) {
				const byId = new Map(previous.map((c) => [c.id, c] as const));
				const next = orderedIds
					.map((id, index) => {
						const item = byId.get(id);
						return item ? { ...item, displayOrder: index } : null;
					})
					.filter(Boolean) as CategoryItem[];

				queryClient.setQueryData(categoriesQueryKey, next);
			}

			return { previous };
		},
		onError: (_err, _vars, ctx) => {
			if (ctx?.previous) queryClient.setQueryData(categoriesQueryKey, ctx.previous);
		},
		onSettled: () => {
			if (invalidateTimeoutRef.current) window.clearTimeout(invalidateTimeoutRef.current);
			invalidateTimeoutRef.current = window.setTimeout(() => {
				queryClient.invalidateQueries({ queryKey: categoriesQueryKey });
			}, 350);
		},
	});

	const sorted = useMemo(
		() => [...categories].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
		[categories],
	);
	const [orderedItems, setOrderedItems] = useState<CategoryItem[]>(sorted);

	useEffect(() => {
		setOrderedItems(sorted);
	}, [sorted]);

	function submitCreate() {
		const name = newName.trim();
		if (!name) return;
		createMutation.mutate({ name, color: newColor });
	}

	function renderItem(item: CategoryItem, props: SortableItemRenderProps) {
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
					onChange={(e) =>
						updateMutation.mutate({ id: item.id, color: e.target.value, name: item.name })
					}
					className="h-8 w-8 shrink-0 cursor-pointer border border-border bg-transparent"
					aria-label="Cor"
				/>
				<Input
					value={item.name}
					onChange={(e) => updateMutation.mutate({ id: item.id, name: e.target.value })}
					className="h-9"
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
						sorted.length <= 1 ? "Você precisa ter pelo menos uma categoria" : "Remover categoria"
					}
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			</div>
		);
	}

	return (
		<ManageDrawer
			drawerKey="categories"
			title="Gerenciar categorias"
			description="Crie, edite, reordene e remova categorias"
		>
			<div className="space-y-4">
				<div className="space-y-2">
					<Title as="div" size="sm">
						Nova categoria
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
							placeholder="Nome da categoria"
							onKeyDown={(e) => {
								if (e.key === "Enter") submitCreate();
							}}
						/>
						<Button onClick={submitCreate} disabled={createMutation.isPending}>
							<Plus className="h-4 w-4" />
							Criar
						</Button>
					</div>
				</div>

				<div className="space-y-2">
					<Title as="div" size="sm">
						Categorias
					</Title>

					{orderedItems.length === 0 ? (
						<div className="text-sm text-muted-foreground">Nenhuma categoria cadastrada.</div>
					) : (
						<SortableList
							items={orderedItems}
							onReorder={(items) => {
								setOrderedItems(items as CategoryItem[]);
								reorderMutation.mutate({ orderedIds: items.map((i) => i.id) });
							}}
							renderItem={renderItem}
						/>
					)}

					<div className="mt-3 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
						Se a categoria tiver tarefas associadas, escolha uma categoria de destino antes de
						remover.
					</div>

					<div className="mt-2 space-y-2">
						{sorted.map((c) => (
							<div key={c.id} className="flex items-center justify-between gap-2">
								<span className="text-xs text-muted-foreground truncate">{c.name}</span>
								<CustomSelect
									items={sorted
										.filter((x) => x.id !== c.id)
										.map((x) => ({ id: x.id, name: x.name, color: x.color }))}
									value={deleteTargetById[c.id] || undefined}
									onValueChange={(newValue) =>
										setDeleteTargetById((s) => ({ ...s, [c.id]: newValue }))
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
