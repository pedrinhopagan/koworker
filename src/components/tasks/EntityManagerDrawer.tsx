import type { UseQueryResult } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CustomSelect } from "@/components/ui/custom-select";
import { Input } from "@/components/ui/input";
import { ManageDrawer } from "@/components/ui/manage-drawer";
import {
	DragHandle,
	type SortableItemRenderProps,
	SortableList,
} from "@/components/ui/sortable-list";
import { Tooltip } from "@/components/ui/tooltip";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { errorMessage } from "@/lib/orpc-errors";
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
	hasLevel?: boolean;
};

type EntityManagerDrawerProps<T extends BaseEntity> = {
	config: EntityConfig;
	// biome-ignore lint/suspicious/noExplicitAny: ORPC hooks have complex types
	hooks: any;
	listQuery: UseQueryResult<T[], Error>;
	// Controle extra por item (ex.: estrutura de prompt da categoria). Renderizado entre o nome e o
	// botão de remover; dono do próprio estado/mutação para não vazar concern de domínio pro genérico.
	renderItemExtra?: (item: T) => ReactNode;
};

type EntityPatch = { name?: string; color?: string; level?: number };

function EntityRow({
	item,
	hasLevel,
	removeLabel,
	removeDisabled,
	isDragging,
	dragHandleProps,
	extra,
	onCommit,
	onRequestRemove,
}: {
	item: BaseEntity & { level?: number };
	hasLevel: boolean;
	removeLabel: string;
	removeDisabled: boolean;
	isDragging: boolean;
	dragHandleProps: SortableItemRenderProps["dragHandleProps"];
	extra: ReactNode;
	onCommit: (patch: EntityPatch) => void;
	onRequestRemove: () => void;
}) {
	const [name, setName] = useDebouncedSearch(item.name, (next) => {
		const trimmed = next.trim();
		if (!trimmed || trimmed === item.name) {
			return;
		}

		onCommit({ name: trimmed });
	});

	const [color, setColor] = useDebouncedSearch(item.color ?? "#000000", (next) => {
		if (next === item.color) {
			return;
		}

		onCommit({ color: next });
	});

	const [level, setLevel] = useDebouncedSearch(String(item.level ?? 1), (next) => {
		const parsed = Number.parseInt(next, 10);
		if (Number.isNaN(parsed) || parsed < 1 || parsed === (item.level ?? 1)) {
			return;
		}

		onCommit({ level: parsed });
	});

	return (
		<div
			className={cn(
				"flex items-center gap-2 rounded-md border border-border bg-card px-2 py-2",
				isDragging && "opacity-60",
			)}
		>
			<DragHandle attributes={dragHandleProps.attributes} listeners={dragHandleProps.listeners} />
			<input
				type="color"
				value={color}
				onChange={(e) => setColor(e.target.value)}
				className="h-8 w-8 shrink-0 cursor-pointer border border-border bg-transparent"
				aria-label="Cor"
			/>
			<Input
				value={name}
				onChange={(e) => setName(e.target.value)}
				onBlur={() => setName(name.trim() || item.name)}
				className="h-9"
			/>
			{hasLevel && (
				<Input
					type="number"
					min={1}
					value={level}
					onChange={(e) => setLevel(e.target.value)}
					className="h-9 w-20"
				/>
			)}

			{extra}

			<Tooltip label={removeLabel}>
				<Button
					variant="ghost"
					size="icon"
					disabled={removeDisabled}
					onClick={onRequestRemove}
					aria-label={removeLabel}
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			</Tooltip>
		</div>
	);
}

export function EntityManagerDrawer<T extends BaseEntity>({
	config,
	hooks,
	listQuery,
	renderItemExtra,
}: EntityManagerDrawerProps<T>) {
	const queryClient = useQueryClient();
	const queryKey = hooks.list.queryOptions().queryKey;
	const entities = (listQuery.data ?? []) as T[];

	const [newName, setNewName] = useState("");
	const [newColor, setNewColor] = useState("#000000");
	const [newLevel, setNewLevel] = useState("1");
	const [pendingDelete, setPendingDelete] = useState<{ item: T; hasTasks: boolean } | null>(null);
	const [migrateTargetId, setMigrateTargetId] = useState("");

	// biome-ignore lint/suspicious/noExplicitAny: ORPC mutations have complex types
	const createMutation = useMutation<any, Error, { name: string; color: string; level?: number }>({
		...hooks.create.mutationOptions(),
		onSuccess: async () => {
			setNewName("");
			setNewLevel("1");
			await queryClient.invalidateQueries({ queryKey });
		},
		onError: (error) =>
			toast.error(errorMessage(error, `Não foi possível criar a ${config.entityName}`)),
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
		onError: (error) =>
			toast.error(errorMessage(error, `Não foi possível salvar a ${config.entityName}`)),
	});

	// biome-ignore lint/suspicious/noExplicitAny: ORPC mutations have complex types
	const deleteMutation = useMutation<any, Error, { id: string }>({
		...hooks.delete.mutationOptions(),
		onSuccess: async () => {
			setPendingDelete(null);
			await queryClient.invalidateQueries({ queryKey });
		},
		onError: (error) =>
			toast.error(errorMessage(error, `Não foi possível remover a ${config.entityName}`)),
	});

	const hasTasksMutation = useMutation<boolean, Error, { id: string }>({
		...hooks.hasAssociatedTasks.mutationOptions(),
		onError: (error) =>
			toast.error(
				errorMessage(error, `Não foi possível checar as tarefas da ${config.entityName}`),
			),
	});
	// biome-ignore lint/suspicious/noExplicitAny: ORPC mutations have complex types
	const migrateAndDeleteMutation = useMutation<any, Error, { sourceId: string; targetId: string }>({
		...hooks.migrateAndDelete.mutationOptions(),
		onSuccess: async () => {
			setPendingDelete(null);
			setMigrateTargetId("");
			await queryClient.invalidateQueries({ queryKey });
			await queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "tasks",
			});
		},
		onError: (error) =>
			toast.error(
				errorMessage(error, `Não foi possível migrar as tarefas da ${config.entityName}`),
			),
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
		onError: (error, _vars, ctx: { previous: T[] | undefined } | undefined) => {
			if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
			toast.error(errorMessage(error, `Não foi possível reordenar as ${config.entityNamePlural}`));
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
		const removeLabel = sorted.length <= 1 ? config.minOneMessage : `Remover ${config.entityName}`;

		return (
			<EntityRow
				item={item}
				hasLevel={!!config.hasLevel}
				removeLabel={removeLabel}
				removeDisabled={
					deleteMutation.isPending ||
					migrateAndDeleteMutation.isPending ||
					hasTasksMutation.isPending ||
					sorted.length <= 1
				}
				isDragging={props.isDragging}
				dragHandleProps={props.dragHandleProps}
				extra={renderItemExtra?.(item)}
				onCommit={(patch) => updateMutation.mutate({ id: item.id, ...patch })}
				onRequestRemove={() => {
					void hasTasksMutation.mutateAsync({ id: item.id }).then(
						(hasTasks) => {
							setMigrateTargetId("");
							setPendingDelete({ item, hasTasks });
						},
						() => null,
					);
				}}
			/>
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
				</div>
			</div>

			<ConfirmDialog
				open={pendingDelete !== null}
				onClose={() => {
					setPendingDelete(null);
					setMigrateTargetId("");
				}}
				onConfirm={() => {
					if (!pendingDelete) return;
					if (!pendingDelete.hasTasks) {
						deleteMutation.mutate({ id: pendingDelete.item.id });
						return;
					}
					if (!migrateTargetId) return;
					migrateAndDeleteMutation.mutate({
						sourceId: pendingDelete.item.id,
						targetId: migrateTargetId,
					});
				}}
				title={`Remover ${config.entityName} "${pendingDelete?.item.name ?? ""}"?`}
				description={
					pendingDelete?.hasTasks
						? `Esta ${config.entityName} tem tarefas associadas. Para qual ${config.entityName} as tarefas devem ir?`
						: "Esta ação não pode ser desfeita."
				}
				confirmLabel="Remover"
				variant="danger"
				loading={deleteMutation.isPending || migrateAndDeleteMutation.isPending}
				confirmDisabled={Boolean(pendingDelete?.hasTasks) && !migrateTargetId}
			>
				{pendingDelete?.hasTasks && (
					<CustomSelect
						items={sorted
							.filter((x) => x.id !== pendingDelete.item.id)
							.map((x) => ({ id: x.id, name: x.name, color: x.color }))}
						value={migrateTargetId || undefined}
						onValueChange={setMigrateTargetId}
						label={`${config.entityNamePlural} de destino`}
						placeholder={`Escolha a ${config.entityName} de destino`}
						variant="default"
						size="md"
						triggerClassName="w-full"
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
				)}
			</ConfirmDialog>
		</ManageDrawer>
	);
}
