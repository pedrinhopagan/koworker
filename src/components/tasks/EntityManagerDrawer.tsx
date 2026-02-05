import type { UseQueryResult } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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
import type { ManageDrawerKey } from "@/stores/manage-drawers";

type BaseEntity = {
	id: string;
	name: string;
	color: string;
	displayOrder: number;
	createdAt: number;
	updatedAt: number | undefined;
};

type EntityConfig = {
	drawerKey: ManageDrawerKey;
	title: string;
	description: string;
	entityName: string;
	entityNamePlural: string;
	minOneMessage: string;
	migrationHelp: string;
	hasLevel?: boolean;
};

type EntityManagerDrawerProps<T extends BaseEntity> = {
	config: EntityConfig;
	// biome-ignore lint/suspicious/noExplicitAny: ORPC hooks have complex types
	hooks: any;
	listQuery: UseQueryResult<T[], Error>;
};

export function EntityManagerDrawer<T extends BaseEntity>({
	config,
	hooks,
	listQuery,
}: EntityManagerDrawerProps<T>) {
	const queryClient = useQueryClient();
	const queryKey = hooks.list.queryOptions().queryKey;
	const entities = (listQuery.data ?? []) as T[];

	const [newName, setNewName] = useState("");
	const [newColor, setNewColor] = useState("#000000");
	const [newLevel, setNewLevel] = useState("1");
	const [deleteTargetById, setDeleteTargetById] = useState<Record<string, string>>({});

	// biome-ignore lint/suspicious/noExplicitAny: ORPC mutations have complex types
	const createMutation = useMutation<any, Error, { name: string; color: string; level?: number }>({
		...hooks.create.mutationOptions(),
		onSuccess: async () => {
			setNewName("");
			setNewLevel("1");
			await queryClient.invalidateQueries({ queryKey });
		},
	});

	// biome-ignore lint/suspicious/noExplicitAny: ORPC mutations have complex types
	const updateMutation = useMutation<
		any,
		Error,
		{ id: string; name?: string; color?: string; level?: number }
	>({
		...hooks.update.mutationOptions(),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey });
		},
	});

	// biome-ignore lint/suspicious/noExplicitAny: ORPC mutations have complex types
	const deleteMutation = useMutation<any, Error, { id: string }>({
		...hooks.delete.mutationOptions(),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey });
		},
	});

	const hasTasksMutation = useMutation<boolean, Error, { id: string }>(
		hooks.hasAssociatedTasks.mutationOptions(),
	);
	// biome-ignore lint/suspicious/noExplicitAny: ORPC mutations have complex types
	const migrateAndDeleteMutation = useMutation<any, Error, { sourceId: string; targetId: string }>({
		...hooks.migrateAndDelete.mutationOptions(),
		onSuccess: async () => {
			setDeleteTargetById({});
			await queryClient.invalidateQueries({ queryKey });
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

	// biome-ignore lint/suspicious/noExplicitAny: ORPC mutations have complex types
	const reorderMutation = useMutation<
		any,
		Error,
		{ orderedIds: string[] },
		{ previous: T[] | undefined }
	>({
		...hooks.reorder.mutationOptions(),
		onMutate: async ({ orderedIds }) => {
			await queryClient.cancelQueries({ queryKey });
			const previous = queryClient.getQueryData(queryKey) as T[] | undefined;

			if (previous && previous.length > 0) {
				const byId = new Map(previous.map((item) => [item.id, item] as const));
				const next = orderedIds
					.map((id, index) => {
						const item = byId.get(id);
						return item ? { ...item, displayOrder: index } : null;
					})
					.filter(Boolean) as T[];

				queryClient.setQueryData(queryKey, next);
			}

			return { previous };
		},
		onError: (_err, _vars, ctx: { previous: T[] | undefined } | undefined) => {
			if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
		},
		onSettled: () => {
			if (invalidateTimeoutRef.current) window.clearTimeout(invalidateTimeoutRef.current);
			invalidateTimeoutRef.current = window.setTimeout(() => {
				queryClient.invalidateQueries({ queryKey });
			}, 350);
		},
	});

	const sorted = useMemo(
		() => [...entities].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
		[entities],
	);
	const [orderedItems, setOrderedItems] = useState<T[]>(sorted);

	useEffect(() => {
		setOrderedItems(sorted);
	}, [sorted]);

	function submitCreate() {
		const name = newName.trim();
		if (!name) return;

		if (config.hasLevel) {
			const level = Number.parseInt(newLevel, 10);
			if (Number.isNaN(level) || level < 1) return;
			createMutation.mutate({ name, color: newColor, level });
		} else {
			createMutation.mutate({ name, color: newColor });
		}
	}

	function renderItem(item: T, props: SortableItemRenderProps) {
		const deleting = deleteMutation.isPending || migrateAndDeleteMutation.isPending;
		const itemWithLevel = item as T & { level?: number };

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
				{config.hasLevel && (
					<Input
						type="number"
						min={1}
						value={itemWithLevel.level ?? 1}
						onChange={(e) => {
							const next = Number.parseInt(e.target.value, 10);
							if (Number.isNaN(next) || next < 1) return;
							updateMutation.mutate({ id: item.id, level: next });
						}}
						className="h-9 w-20"
					/>
				)}

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
					title={sorted.length <= 1 ? config.minOneMessage : `Remover ${config.entityName}`}
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			</div>
		);
	}

	return (
		<ManageDrawer
			drawerKey={config.drawerKey}
			title={config.title}
			description={config.description}
		>
			<div className="space-y-4">
				<div className="space-y-2">
					<Title as="div" size="sm">
						Nova {config.entityName}
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
							placeholder={`Nome da ${config.entityName}`}
							onKeyDown={(e) => {
								if (e.key === "Enter") submitCreate();
							}}
						/>
						{config.hasLevel && (
							<Input
								type="number"
								min={1}
								value={newLevel}
								onChange={(e) => setNewLevel(e.target.value)}
								placeholder="Nível"
								className="w-24"
							/>
						)}
						<Button onClick={submitCreate} disabled={createMutation.isPending}>
							<Plus className="h-4 w-4" />
							Criar
						</Button>
					</div>
				</div>

				<div className="space-y-2">
					<Title as="div" size="sm">
						{config.entityNamePlural}
					</Title>

					{orderedItems.length === 0 ? (
						<div className="text-sm text-muted-foreground">
							Nenhuma {config.entityName} cadastrada.
						</div>
					) : (
						<SortableList
							items={orderedItems}
							onReorder={(items) => {
								setOrderedItems(items as T[]);
								reorderMutation.mutate({ orderedIds: items.map((i) => i.id) });
							}}
							renderItem={renderItem}
						/>
					)}

					<div className="mt-3 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
						{config.migrationHelp}
					</div>

					<div className="mt-2 space-y-2">
						{sorted.map((item) => (
							<div key={item.id} className="flex items-center justify-between gap-2">
								<span className="text-xs text-muted-foreground truncate">{item.name}</span>
								<CustomSelect
									items={sorted
										.filter((x) => x.id !== item.id)
										.map((x) => ({ id: x.id, name: x.name, color: x.color }))}
									value={deleteTargetById[item.id] || undefined}
									onValueChange={(newValue) =>
										setDeleteTargetById((s) => ({ ...s, [item.id]: newValue }))
									}
									label="Destino (se necessário)"
									placeholder="Destino (se necessário)"
									variant="default"
									size="sm"
									triggerClassName="min-w-[220px]"
									renderItem={(selectItem) => (
										<div className="w-full px-3 py-2 flex items-center gap-2 text-sm text-foreground">
											<span
												className="size-2 rounded-full shrink-0"
												style={{ backgroundColor: selectItem.color ?? "#6b7280" }}
											/>
											<span className="truncate">{selectItem.name}</span>
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
