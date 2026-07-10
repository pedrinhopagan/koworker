import { Sparkles } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";

import { Text, Title } from "@/components/typography";
import { cn } from "@/lib/utils";
import type { ProjectFormValues } from "./project-form";
import { defaultProjectColor, projectColorOptions } from "@/constants/colors";

export function ProjectFormColors() {
	const { register, setValue, control } = useFormContext<ProjectFormValues>();
	const selectedColor = useWatch({ control, name: "color" }) || defaultProjectColor;

	return (
		<section className="rounded-lg border border-border bg-card/40 p-4">
			<div className="flex items-center gap-3">
				<div className="size-10 rounded-md bg-muted/50 flex items-center justify-center">
					<Sparkles className="size-5 text-muted-foreground" />
				</div>
				<div>
					<Title size="sm">Cor do projeto</Title>
					<Text size="sm" tone="muted">
						Escolha uma cor para destacar o projeto
					</Text>
				</div>
			</div>

			<input type="hidden" {...register("color")} />

			<div className="mt-4 grid gap-3">
				<Text size="xs" tone="muted">
					Cor selecionada: {selectedColor}
				</Text>
				<div className="grid grid-cols-6 gap-2">
					{projectColorOptions.map((color) => (
						<button
							key={color.value}
							type="button"
							title={color.label}
							onClick={() => setValue("color", color.value, { shouldDirty: true })}
							className={cn(
								"relative h-8 w-full rounded-md border-2 transition",
								selectedColor === color.value ? "border-foreground" : "border-transparent",
							)}
							style={{ backgroundColor: color.value }}
						/>
					))}
				</div>
				<Text size="xs" tone="muted">
					Essa cor aparece nos cards e tarefas.
				</Text>
			</div>
		</section>
	);
}
