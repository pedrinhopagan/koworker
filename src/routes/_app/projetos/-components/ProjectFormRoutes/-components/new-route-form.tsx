import { Plus } from "lucide-react";
import { useState } from "react";
import { useFormContext } from "react-hook-form";

import { Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { IconPicker } from "@/components/ui/icon-picker";
import { Input } from "@/components/ui/input";
import { isTauri, pickProjectFolder } from "@/lib/tauri";
import type { ProjectFormValues } from "../../project-form";

type NewRouteFormProps = {
	projectId: string;
	onCreate: (data: {
		projectId: string;
		name: string;
		route: string;
		icon?: string;
		command?: string;
	}) => void;
	isCreating: boolean;
};

export function NewRouteForm({ projectId, onCreate, isCreating }: NewRouteFormProps) {
	const canPick = isTauri();
	const { getValues } = useFormContext<ProjectFormValues>();

	const [name, setName] = useState("");
	const [route, setRoute] = useState("");
	const [icon, setIcon] = useState<string>("FolderOpen");
	const [command, setCommand] = useState("");
	const [pickingRoute, setPickingRoute] = useState(false);

	function handleSubmit() {
		const trimmedName = name.trim();
		const trimmedRoute = route.trim();

		if (!trimmedName || !trimmedRoute) return;

		onCreate({
			projectId,
			name: trimmedName,
			route: trimmedRoute,
			icon: icon || undefined,
			command: command.trim() || undefined,
		});

		// Reset form
		setName("");
		setRoute("");
		setIcon("FolderOpen");
		setCommand("");
	}

	async function handlePickRoute() {
		if (!canPick || pickingRoute) return;

		setPickingRoute(true);
		const mainRoute = getValues("mainRoute");
		const startIn = route?.trim() || mainRoute?.trim() || undefined;
		const selectedPath = await pickProjectFolder(startIn);

		if (selectedPath) {
			setRoute(selectedPath);
		}
		setPickingRoute(false);
	}

	return (
		<div className="space-y-2">
			<Title as="div" size="sm">
				Nova rota
			</Title>
			<div className="flex flex-col gap-2 rounded-md border border-border bg-card/50 px-3 py-3">
				<div className="flex items-center gap-2">
					<IconPicker value={icon} onChange={setIcon} className="h-9 w-12 shrink-0" />
					<Input
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Nome (ex: Front, API)"
						className="h-9 flex-1"
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								handleSubmit();
							}
						}}
					/>
				</div>
				<div className="flex items-center gap-2">
					<Input
						value={route}
						onChange={(e) => setRoute(e.target.value)}
						placeholder="Caminho absoluto"
						className="h-9 flex-1"
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								handleSubmit();
							}
						}}
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
					value={command}
					onChange={(e) => setCommand(e.target.value)}
					placeholder="Comando (opcional)"
					className="h-9"
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							handleSubmit();
						}
					}}
				/>
				<Button
					type="button"
					onClick={handleSubmit}
					disabled={isCreating || !name.trim() || !route.trim()}
					className="self-end"
				>
					<Plus className="h-4 w-4 mr-2" />
					Adicionar
				</Button>
			</div>
		</div>
	);
}
