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

type PriorityItem = {
	id: string;
	name: string;
	color: string | null;
	level: number;
	displayOrder: number;
};

type Props = {
	open: boolean;
	onClose: () => void;
};

export function PriorityManagerDrawer({ open, onClose }: Props) {
	const queryClient = useQueryClient();
	const prioritiesQuery = useQuery(orpc.priorities.list.queryOptions());
	const priorities = (prioritiesQuery.data ?? []) as PriorityItem[];

	const [newName, setNewName] = useState("");
	const [newColor, setNewColor] = useState("#000000");
	const [newLevel, setNewLevel] = useState("1");
	const [deleteTargetById, setDeleteTargetById] = useState<Record<string, string>>({});

	const createMutation = useMutation({
		...orpc.priorities.create.mutationOptions(),
		onSuccess: async () => {
			setNewName("");
			setNewLevel("1");
			await queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "priorities",
			});
		},
	});

	const updateMutation = useMutation({
		...orpc.priorities.update.mutationOptions(),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "priorities",
			});
		},
	});

	const deleteMutation = useMutation({
		...orpc.priorities.delete.mutationOptions(),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "priorities",
			});
		},
	});

	const hasTasksMutation = useMutation(orpc.priorities.hasAssociatedTasks.mutationOptions());
	const migrateAndDeleteMutation = useMutation({
		...orpc.priorities.migrateAndDelete.mutationOptions(),
		onSuccess: async () => {
			setDeleteTargetById({});
			await queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "priorities",
			});
			await queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "tasks",
			});
		},
	});

	const reorderMutation = useMutation({
		...orpc.priorities.reorder.mutationOptions(),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "priorities",
			});
		},
	});

	const sorted = useMemo(
		() => [...priorities].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
		[priorities],
	);

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
		<Drawer
			open={open}
			onClose={onClose}
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

					{sorted.length === 0 ? (
						<div className="text-sm text-muted-foreground">Nenhuma prioridade cadastrada.</div>
					) : (
						<SortableList
							items={sorted.map((p) => ({ ...p, id: p.id }))}
							onReorder={(items) => {
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
								<select
									value={deleteTargetById[p.id] ?? ""}
									onChange={(e) => setDeleteTargetById((s) => ({ ...s, [p.id]: e.target.value }))}
									className="h-8 rounded-md border border-border bg-card px-2 text-xs"
								>
									<option value="">Destino (se necessário)</option>
									{sorted
										.filter((x) => x.id !== p.id)
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
