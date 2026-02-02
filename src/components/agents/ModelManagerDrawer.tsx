import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { orpc } from "@/client";
import { Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ManageDrawer } from "@/components/ui/manage-drawer";
import {
	DragHandle,
	type SortableItemRenderProps,
	SortableList,
} from "@/components/ui/sortable-list";
import { cn } from "@/lib/utils";

type ModelItem = {
	id: string;
	name: string;
	provider: string | undefined;
	modelId: string | undefined;
	color: string;
	displayOrder: number;
	createdAt: number;
	updatedAt: number | undefined;
};

export function ModelManagerDrawer() {
	const queryClient = useQueryClient();
	const modelsQueryOptions = orpc.models.list.queryOptions();
	const modelsQuery = useQuery(modelsQueryOptions);
	const models = (modelsQuery.data ?? []) as ModelItem[];
	const modelsQueryKey = modelsQueryOptions.queryKey;

	const [newName, setNewName] = useState("");
	const [newColor, setNewColor] = useState("#6b7280");

	const createMutation = useMutation({
		...orpc.models.create.mutationOptions(),
		onSuccess: async () => {
			setNewName("");
			await queryClient.invalidateQueries({ queryKey: modelsQueryKey });
		},
	});

	const updateMutation = useMutation({
		...orpc.models.update.mutationOptions(),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: modelsQueryKey });
		},
	});

	const deleteMutation = useMutation({
		...orpc.models.delete.mutationOptions(),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: modelsQueryKey });
		},
	});

	const invalidateTimeoutRef = useRef<number | null>(null);

	useEffect(() => {
		return () => {
			if (invalidateTimeoutRef.current) window.clearTimeout(invalidateTimeoutRef.current);
		};
	}, []);

	const reorderMutation = useMutation({
		...orpc.models.reorder.mutationOptions(),
		onMutate: async ({ orderedIds }) => {
			await queryClient.cancelQueries({ queryKey: modelsQueryKey });
			const previous = queryClient.getQueryData(modelsQueryKey) as ModelItem[] | undefined;

			if (previous && previous.length > 0) {
				const byId = new Map(previous.map((c) => [c.id, c] as const));
				const next = orderedIds
					.map((id, index) => {
						const item = byId.get(id);
						return item ? { ...item, displayOrder: index } : null;
					})
					.filter(Boolean) as ModelItem[];

				queryClient.setQueryData(modelsQueryKey, next);
			}

			return { previous };
		},
		onError: (_err, _vars, ctx) => {
			if (ctx?.previous) queryClient.setQueryData(modelsQueryKey, ctx.previous);
		},
		onSettled: () => {
			if (invalidateTimeoutRef.current) window.clearTimeout(invalidateTimeoutRef.current);
			invalidateTimeoutRef.current = window.setTimeout(() => {
				queryClient.invalidateQueries({ queryKey: modelsQueryKey });
			}, 350);
		},
	});

	const sorted = useMemo(
		() => [...models].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
		[models],
	);
	const [orderedItems, setOrderedItems] = useState<ModelItem[]>(sorted);

	useEffect(() => {
		setOrderedItems(sorted);
	}, [sorted]);

	function submitCreate() {
		const name = newName.trim();
		if (!name) return;
		createMutation.mutate({ name, color: newColor });
	}

	function renderItem(item: ModelItem, props: SortableItemRenderProps) {
		const deleting = deleteMutation.isPending;
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
					value={item.color ?? "#6b7280"}
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
					onClick={() => {
						deleteMutation.mutate({ id: item.id });
					}}
					title={sorted.length <= 1 ? "Você precisa ter pelo menos um modelo" : "Remover modelo"}
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			</div>
		);
	}

	return (
		<ManageDrawer
			drawerKey="models"
			title="Gerenciar modelos"
			description="Crie, edite, reordene e remova modelos de IA"
		>
			<div className="space-y-4">
				<div className="space-y-2">
					<Title as="div" size="sm">
						Novo modelo
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
							placeholder="Nome do modelo"
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
						Modelos
					</Title>

					{orderedItems.length === 0 ? (
						<div className="text-sm text-muted-foreground">Nenhum modelo cadastrado.</div>
					) : (
						<SortableList
							items={orderedItems}
							onReorder={(items) => {
								setOrderedItems(items as ModelItem[]);
								reorderMutation.mutate({ orderedIds: items.map((i) => i.id) });
							}}
							renderItem={renderItem}
						/>
					)}
				</div>
			</div>
		</ManageDrawer>
	);
}
