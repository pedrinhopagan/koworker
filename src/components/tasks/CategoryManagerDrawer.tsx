import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { orpc } from "@/client";
import { Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import {
	DragHandle,
	SortableList,
	type SortableItemRenderProps,
} from "@/components/ui/sortable-list";
import { cn } from "@/lib/utils";

type CategoryItem = {
	id: string;
	name: string;
	color: string | null;
	displayOrder: number;
};

type Props = {
	open: boolean;
	onClose: () => void;
};

export function CategoryManagerDrawer({ open, onClose }: Props) {
	const queryClient = useQueryClient();
	const categoriesQuery = useQuery(orpc.categories.list.queryOptions());
	const categories = (categoriesQuery.data ?? []) as CategoryItem[];

	const [newName, setNewName] = useState("");
	const [newColor, setNewColor] = useState("#000000");
	const [deleteTargetById, setDeleteTargetById] = useState<Record<string, string>>({});

	const createMutation = useMutation({
		...orpc.categories.create.mutationOptions(),
		onSuccess: async () => {
			setNewName("");
			await queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "categories",
			});
		},
	});

	const updateMutation = useMutation({
		...orpc.categories.update.mutationOptions(),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "categories",
			});
		},
	});

	const deleteMutation = useMutation({
		...orpc.categories.delete.mutationOptions(),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "categories",
			});
		},
	});

	const hasTasksMutation = useMutation(orpc.categories.hasAssociatedTasks.mutationOptions());
	const migrateAndDeleteMutation = useMutation({
		...orpc.categories.migrateAndDelete.mutationOptions(),
		onSuccess: async () => {
			setDeleteTargetById({});
			await queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "categories",
			});
			await queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "tasks",
			});
		},
	});

	const reorderMutation = useMutation({
		...orpc.categories.reorder.mutationOptions(),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "categories",
			});
		},
	});

	const sorted = useMemo(
		() => [...categories].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
		[categories],
	);

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
		<Drawer
			open={open}
			onClose={onClose}
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

					{sorted.length === 0 ? (
						<div className="text-sm text-muted-foreground">Nenhuma categoria cadastrada.</div>
					) : (
						<SortableList
							items={sorted.map((c) => ({ ...c, id: c.id }))}
							onReorder={(items) => {
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
								<select
									value={deleteTargetById[c.id] ?? ""}
									onChange={(e) => setDeleteTargetById((s) => ({ ...s, [c.id]: e.target.value }))}
									className="h-8 rounded-md border border-border bg-card px-2 text-xs"
								>
									<option value="">Destino (se necessário)</option>
									{sorted
										.filter((x) => x.id !== c.id)
										.map((x) => (
											<option key={x.id} value={x.id}>
												{x.name}
											</option>
										))}
								</select>
							</div>
						))}
					</div>
				</div>
			</div>
		</Drawer>
	);
}
