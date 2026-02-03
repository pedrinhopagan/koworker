import { Check, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { IconPicker } from "@/components/ui/icon-picker";
import { Input } from "@/components/ui/input";
import { DragHandle, type SortableItemRenderProps } from "@/components/ui/sortable-list";
import { isTauri, pickProjectFolder } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import type { ProjectFormValues } from "../../project-form";
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
	const canPick = isTauri();
	const { getValues } = useFormContext<ProjectFormValues>();

	const [localName, setLocalName] = useState(item.name);
	const [localRoute, setLocalRoute] = useState(item.route);
	const [localCommand, setLocalCommand] = useState(item.command ?? "");
	const [pickingRoute, setPickingRoute] = useState(false);
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	useEffect(() => {
		setLocalName(item.name);
		setLocalRoute(item.route);
		setLocalCommand(item.command ?? "");
	}, [item.name, item.route, item.command]);

	function handleSubmit() {
		if (!localName.trim() || !localRoute.trim()) return;

		onUpdate({
			id: item.id,
			name: localName,
			route: localRoute,
			command: localCommand || undefined,
		});
	}

	function handleIconChange(icon: string) {
		onUpdate({ id: item.id, icon });
	}

	async function handlePickRoute() {
		if (!canPick || pickingRoute) return;

		setPickingRoute(true);
		const mainRoute = getValues("mainRoute");
		const startIn = localRoute?.trim() || mainRoute?.trim() || undefined;
		const selectedPath = await pickProjectFolder(startIn);

		if (selectedPath) {
			setLocalRoute(selectedPath);
		}
		setPickingRoute(false);
	}

	function handleConfirmDelete() {
		onDelete(item.id);
		setConfirmingDelete(false);
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

				<IconPicker value={item.icon} onChange={handleIconChange} className="h-9 w-12 shrink-0" />

				<Input
					value={localName}
					onChange={(e) => setLocalName(e.target.value)}
					onBlur={handleSubmit}
					placeholder="Nome (ex: Front, API)"
					className="h-9 flex-1"
				/>

				{confirmingDelete ? (
					<Button
						type="button"
						variant="ghost"
						size="icon"
						disabled={isDeleting}
						onClick={handleConfirmDelete}
						title="Confirmar remoção"
						className="text-destructive hover:text-destructive hover:bg-destructive/10"
					>
						<Check className="h-4 w-4" />
					</Button>
				) : (
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={() => setConfirmingDelete(true)}
						title="Remover rota"
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				)}
			</div>

			<div className="flex items-center gap-2">
				<Input
					value={localRoute}
					onChange={(e) => setLocalRoute(e.target.value)}
					onBlur={handleSubmit}
					placeholder="Caminho absoluto"
					className="h-9 flex-1"
				/>
				{canPick && (
					<Button
						type="button"
						variant="outline"
						onClick={handlePickRoute}
						disabled={pickingRoute}
						className="shrink-0 px-3 h-9"
					>
						...
					</Button>
				)}
			</div>

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
