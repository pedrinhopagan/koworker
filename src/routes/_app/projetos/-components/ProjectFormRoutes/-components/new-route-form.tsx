import { Plus } from "lucide-react";
import { useState } from "react";
import { useFormContext } from "react-hook-form";

import { FolderPathInput } from "@/components/settings/folder-path-input";
import { Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { IconSelector } from "@/components/ui/icon-selector";
import { Input } from "@/components/ui/input";
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
	const { getValues } = useFormContext<ProjectFormValues>();

	const mainRoute = getValues("mainRoute");

	const [name, setName] = useState("");
	const [route, setRoute] = useState(mainRoute || "");
	const [icon, setIcon] = useState<string>("FolderOpen");
	const [command, setCommand] = useState("");

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
		setRoute(mainRoute || "");
		setIcon("FolderOpen");
		setCommand("");
	}

	return (
		<div className="space-y-2">
			<Title as="div" size="sm">
				Nova rota
			</Title>
			<div className="flex flex-col gap-2 rounded-md border border-border bg-card/50 px-3 py-3">
				<div className="flex items-center gap-2">
					<IconSelector value={icon} onChange={setIcon} className="h-9 w-12 shrink-0" />
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
				<FolderPathInput
					value={route}
					onChange={setRoute}
					onEnter={handleSubmit}
					placeholder="Caminho absoluto"
				/>
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
