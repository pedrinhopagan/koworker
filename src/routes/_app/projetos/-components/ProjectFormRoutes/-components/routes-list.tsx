import { useEffect, useMemo, useState } from "react";

import { Title } from "@/components/typography";
import { type SortableItemRenderProps, SortableList } from "@/components/ui/sortable-list";
import type { ProjectRouteItem } from "../-utils/types";
import { RouteItem } from "./route-item";

type RoutesListProps = {
	routes: ProjectRouteItem[];
	onUpdate: (data: {
		id: string;
		name?: string;
		route?: string;
		icon?: string;
		command?: string;
	}) => void;
	onDelete: (id: string) => void;
	onReorder: (orderedIds: string[]) => void;
	isDeleting: boolean;
};

export function RoutesList({ routes, onUpdate, onDelete, onReorder, isDeleting }: RoutesListProps) {
	const sorted = useMemo(
		() => [...routes].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
		[routes],
	);

	const [orderedItems, setOrderedItems] = useState<ProjectRouteItem[]>(sorted);

	useEffect(() => {
		setOrderedItems(sorted);
	}, [sorted]);

	function handleReorder(items: ProjectRouteItem[]) {
		setOrderedItems(items);
		onReorder(items.map((item) => item.id));
	}

	function renderItem(item: ProjectRouteItem, props: SortableItemRenderProps) {
		return (
			<RouteItem
				item={item}
				props={props}
				onUpdate={onUpdate}
				onDelete={onDelete}
				isDeleting={isDeleting}
			/>
		);
	}

	return (
		<div className="space-y-2">
			<Title as="div" size="sm">
				Rotas ({orderedItems.length})
			</Title>

			{orderedItems.length === 0 ? (
				<div className="text-sm text-muted-foreground py-4 text-center">
					Nenhuma rota cadastrada
				</div>
			) : (
				<SortableList
					items={orderedItems}
					onReorder={(items) => handleReorder(items as ProjectRouteItem[])}
					renderItem={renderItem}
				/>
			)}

			<div className="mt-3 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
				As rotas aparecem como botões ao lado do Terminal quando o projeto está selecionado. Arraste
				para reordenar.
			</div>
		</div>
	);
}
