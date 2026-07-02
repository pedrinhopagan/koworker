import { useState } from "react";

import { FolderPathInput } from "@/components/settings/folder-path-input";
import { DeleteConfirmButton } from "@/components/ui/delete-confirm-button";
import { IconSelector } from "@/components/ui/icon-selector";
import { Input } from "@/components/ui/input";
import { DragHandle, type SortableItemRenderProps } from "@/components/ui/sortable-list";
import { cn } from "@/lib/utils";
import type { ProjectRouteItem } from "../-utils/types";

type RouteItemProps = {
	item: ProjectRouteItem;
	props: SortableItemRenderProps;
	onUpdate: (data: {
		id: string;
		name?: string;
		route?: string;
		icon?: string;
		command?: string;
	}) => void;
	onDelete: (id: string) => void;
	isDeleting: boolean;
};

export function RouteItem({ item, props, onUpdate, onDelete, isDeleting }: RouteItemProps) {
	const [localName, setLocalName] = useState(item.name);
	const [localRoute, setLocalRoute] = useState(item.route);
	const [localCommand, setLocalCommand] = useState(item.command ?? "");

	function handleSubmit() {
		const nextName = localName.trim();
		const nextRoute = localRoute.trim();
		const nextCommand = localCommand.trim() || undefined;
		const currentCommand = item.command?.trim() || undefined;

		if (!nextName || !nextRoute) return;
		if (nextName === item.name && nextRoute === item.route && nextCommand === currentCommand)
			return;

		onUpdate({
			id: item.id,
			name: nextName,
			route: nextRoute,
			command: nextCommand,
		});
	}

	function handleIconChange(icon: string) {
		onUpdate({ id: item.id, icon });
	}

	return (
		<div
			className={cn(
				"flex flex-col gap-2 rounded-md border border-border bg-card px-3 py-3",
				props.isDragging && "opacity-60",
			)}
		>
			<div className="flex items-center gap-2">
				<DragHandle
					attributes={props.dragHandleProps.attributes}
					listeners={props.dragHandleProps.listeners}
				/>

				<IconSelector value={item.icon} onChange={handleIconChange} className="h-9 w-12 shrink-0" />

				<Input
					value={localName}
					onChange={(e) => setLocalName(e.target.value)}
					onBlur={handleSubmit}
					placeholder="Nome (ex: Front, API)"
					className="h-9 flex-1"
				/>

				<DeleteConfirmButton
					onDelete={() => onDelete(item.id)}
					disabled={isDeleting}
					title="Remover rota"
					confirmTitle="Confirmar remoção da rota"
				/>
			</div>

			<FolderPathInput
				value={localRoute}
				onChange={setLocalRoute}
				onBlur={handleSubmit}
				placeholder="Caminho absoluto"
			/>

			<Input
				value={localCommand}
				onChange={(e) => setLocalCommand(e.target.value)}
				onBlur={handleSubmit}
				placeholder="Comando (opcional)"
				className="h-9"
			/>
		</div>
	);
}
