import { FolderOpen } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";

import { FolderPathInput } from "@/components/settings/folder-path-input";
import { Text, Title } from "@/components/typography";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectFormValues } from "./project-form";

export function ProjectFormBasics() {
	const {
		register,
		control,
		formState: { errors },
		setValue,
	} = useFormContext<ProjectFormValues>();

	const mainRoute = useWatch({ control, name: "mainRoute" }) ?? "";

	const hasNameError = !!errors.name;
	const hasRouteError = !!errors.mainRoute;

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
					<FolderPathInput
						id="mainRoute"
						value={mainRoute}
						onChange={(value) =>
							setValue("mainRoute", value, { shouldDirty: true, shouldValidate: true })
						}
						placeholder="~/projetos/meu-app"
						invalid={hasRouteError}
					/>
					<Text size="xs" tone="muted">
						Caminho absoluto para a pasta raiz do projeto
					</Text>
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
