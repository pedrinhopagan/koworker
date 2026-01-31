import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	KeyboardSensor,
	PointerSensor,
	type UniqueIdentifier,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	horizontalListSortingStrategy,
	SortableContext,
	type SortingStrategy,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface SortableItem {
	id: string;
}

interface SortableListProps<T extends SortableItem> {
	/** Array of items to render. Each item must have an `id` property. */
	items: T[];
	/** Called when items are reordered. Receives the new array of items. */
	onReorder: (items: T[]) => void;
	/** Render function for each item. Receives the item and drag handle props. */
	renderItem: (item: T, props: SortableItemRenderProps) => React.ReactNode;
	/** Optional render function for the drag overlay (ghost element). */
	renderDragOverlay?: (item: T) => React.ReactNode;
	/** Sorting strategy. Defaults to vertical. */
	strategy?: "vertical" | "horizontal";
	/** Container className */
	className?: string;
	/** Item wrapper className */
	itemClassName?: string;
	/** Whether the list is disabled */
	disabled?: boolean;
}

interface SortableItemRenderProps {
	/** Ref to attach to the draggable element */
	ref: (node: HTMLElement | null) => void;
	/** Props to spread on the drag handle element */
	dragHandleProps: {
		attributes: React.HTMLAttributes<HTMLElement>;
		listeners: unknown;
	};
	/** Whether this item is currently being dragged */
	isDragging: boolean;
	/** Style to apply for transform/transition during drag */
	style: React.CSSProperties;
}

interface SortableItemWrapperProps<T extends SortableItem> {
	item: T;
	renderItem: SortableListProps<T>["renderItem"];
	itemClassName?: string;
	disabled?: boolean;
}

// ============================================================================
// Components
// ============================================================================

function SortableItemWrapper<T extends SortableItem>({
	item,
	renderItem,
	itemClassName,
	disabled,
}: SortableItemWrapperProps<T>) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: item.id,
		disabled,
	});

	const style: React.CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	const renderProps: SortableItemRenderProps = {
		ref: setNodeRef,
		dragHandleProps: {
			attributes,
			listeners,
		},
		isDragging,
		style,
	};

	return (
		<div className={itemClassName} style={style} ref={setNodeRef}>
			{renderItem(item, renderProps)}
		</div>
	);
}

function SortableList<T extends SortableItem>({
	items,
	onReorder,
	renderItem,
	renderDragOverlay,
	strategy = "vertical",
	className,
	itemClassName,
	disabled = false,
}: SortableListProps<T>) {
	const [activeId, setActiveId] = React.useState<UniqueIdentifier | null>(null);

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				// 8px movement required before drag starts
				distance: 8,
			},
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const sortingStrategy: SortingStrategy =
		strategy === "horizontal" ? horizontalListSortingStrategy : verticalListSortingStrategy;

	const activeItem = React.useMemo(
		() => items.find((item) => item.id === activeId),
		[activeId, items],
	);

	function handleDragStart(event: DragStartEvent) {
		setActiveId(event.active.id);
	}

	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;

		if (over && active.id !== over.id) {
			const oldIndex = items.findIndex((item) => item.id === active.id);
			const newIndex = items.findIndex((item) => item.id === over.id);

			if (oldIndex !== -1 && newIndex !== -1) {
				const newItems = arrayMove(items, oldIndex, newIndex);
				onReorder(newItems);
			}
		}

		setActiveId(null);
	}

	function handleDragCancel() {
		setActiveId(null);
	}

	const itemIds = React.useMemo(() => items.map((item) => item.id), [items]);

	return (
		<DndContext
			sensors={sensors}
			collisionDetection={closestCenter}
			onDragStart={handleDragStart}
			onDragEnd={handleDragEnd}
			onDragCancel={handleDragCancel}
		>
			<SortableContext items={itemIds} strategy={sortingStrategy}>
				<div
					className={cn(
						strategy === "horizontal" ? "flex flex-row gap-2" : "flex flex-col gap-1",
						className,
					)}
				>
					{items.map((item) => (
						<SortableItemWrapper
							key={item.id}
							item={item}
							renderItem={renderItem}
							itemClassName={itemClassName}
							disabled={disabled}
						/>
					))}
				</div>
			</SortableContext>

			<DragOverlay>
				{activeItem && renderDragOverlay ? (
					renderDragOverlay(activeItem)
				) : activeItem ? (
					<div className="opacity-80 shadow-lg">
						{renderItem(activeItem, {
							ref: () => {},
							dragHandleProps: {
								attributes: {},
								listeners: undefined,
							},
							isDragging: true,
							style: {},
						})}
					</div>
				) : null}
			</DragOverlay>
		</DndContext>
	);
}

// ============================================================================
// DragHandle Component
// ============================================================================

interface DragHandleProps {
	attributes: React.HTMLAttributes<HTMLElement>;
	listeners: unknown;
	className?: string;
	disabled?: boolean;
}

function DragHandle({ attributes, listeners, className, disabled }: DragHandleProps) {
	return (
		<button
			type="button"
			className={cn(
				"cursor-grab touch-none p-1 text-muted-foreground hover:text-foreground transition-colors",
				"focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
				disabled && "cursor-not-allowed opacity-50",
				className,
			)}
			disabled={disabled}
			{...attributes}
			{...(listeners as React.HTMLAttributes<HTMLButtonElement>)}
		>
			<GripVertical className="size-4" />
		</button>
	);
}

// ============================================================================
// Exports
// ============================================================================

export { SortableList, DragHandle, arrayMove };
export type { SortableListProps, SortableItemRenderProps, SortableItem, DragHandleProps };
