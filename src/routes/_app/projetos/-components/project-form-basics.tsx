import { FolderOpen } from "lucide-react";
import { useState } from "react";
import { useFormContext } from "react-hook-form";

import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isTauri, pickProjectFolder } from "@/lib/tauri";
import type { ProjectFormValues } from "./project-form";

export function ProjectFormBasics() {
	const {
		register,
		formState: { errors },
		setValue,
		getValues,
	} = useFormContext<ProjectFormValues>();
	const [picking, setPicking] = useState(false);

	const hasNameError = !!errors.name;
	const hasRouteError = !!errors.mainRoute;

	const canPick = isTauri();

	const handlePickFolder = async () => {
		if (!canPick || picking) return;

		setPicking(true);
		const currentPath = getValues("mainRoute");
		const selectedPath = await pickProjectFolder(currentPath?.trim() || undefined);

		if (selectedPath) {
			setValue("mainRoute", selectedPath, { shouldDirty: true, shouldTouch: true });
		}
		setPicking(false);
	};

	return (
		<section className="rounded-lg border border-border bg-card/40 p-4">
			<div className="flex items-center gap-3">
				<div className="size-10 rounded-md bg-muted/50 flex items-center justify-center">
					<FolderOpen className="size-5 text-muted-foreground" />
				</div>
				<div>
					<Title size="sm">Informações básicas</Title>
					<Text size="sm" tone="muted">
						Nome, caminho e contexto do projeto
					</Text>
				</div>
			</div>

			<div className="mt-4 grid gap-4">
				<div className="grid gap-2">
					<Label htmlFor="name">Nome</Label>
					<Input
						id="name"
						placeholder="Ex: Dogama"
						aria-invalid={hasNameError}
						{...register("name")}
						required
					/>
					{hasNameError && (
						<Text size="sm" tone="destructive">
							Nome obrigatório
						</Text>
					)}
				</div>

				<div className="grid gap-2">
					<Label htmlFor="mainRoute">Caminho</Label>
					<div className="flex gap-2">
						<Input
							id="mainRoute"
							placeholder="/home/usuario/projeto"
							aria-invalid={hasRouteError}
							{...register("mainRoute")}
							required
						/>
						<Button
							type="button"
							variant="outline"
							onClick={handlePickFolder}
							disabled={!canPick || picking}
							className="shrink-0 px-3"
						>
							...
						</Button>
					</div>
					<Text size="xs" tone="muted">
						Caminho absoluto para a pasta raiz do projeto
					</Text>
					{!canPick && (
						<Text size="xs" tone="muted">
							Seleção automática disponível apenas no desktop
						</Text>
					)}
					{hasRouteError && (
						<Text size="sm" tone="destructive">
							Caminho obrigatório
						</Text>
					)}
				</div>

				<div className="grid gap-2">
					<Label htmlFor="description">Descrição (opcional)</Label>
					<Textarea
						id="description"
						placeholder="Breve descrição do projeto"
						{...register("description")}
					/>
				</div>
			</div>
		</section>
	);
}
