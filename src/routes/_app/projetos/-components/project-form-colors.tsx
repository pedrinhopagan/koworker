import { Check, Sparkles } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";

import { Text, Title } from "@/components/typography";
import { cn } from "@/lib/utils";
import type { ProjectFormValues } from "./project-form";
import { defaultProjectColor, projectColorFamilies, projectColorOptions } from "@/constants/colors";

export function ProjectFormColors() {
	const { register, setValue, control } = useFormContext<ProjectFormValues>();
	const selectedColor = useWatch({ control, name: "color" }) || defaultProjectColor;
	const selectedLabel = projectColorOptions.find((color) => color.value === selectedColor)?.label;

	return (
		<section className="rounded-lg border border-border bg-card/40 p-4">
			<div className="flex items-center gap-3">
				<div className="size-10 rounded-md bg-muted/50 flex items-center justify-center">
					<Sparkles className="size-5 text-muted-foreground" />
				</div>
				<div>
					<Title size="sm">Cor do projeto</Title>
					<Text size="sm" tone="muted">
						Use tons da mesma família para projetos relacionados
					</Text>
				</div>
			</div>

			<input type="hidden" {...register("color")} />

			<div className="mt-4 grid gap-3 sm:grid-cols-2">
				{projectColorFamilies.map((family) => (
					<div key={family.name} className="grid gap-1.5">
						<Text size="xs" tone="muted">
							{family.name}
						</Text>
						<div className="flex gap-1.5">
							{family.colors.map((color) => (
								<button
									key={color.value}
									type="button"
									title={color.label}
									onClick={() => setValue("color", color.value, { shouldDirty: true })}
									className={cn(
										"relative h-8 flex-1 rounded-md transition",
										selectedColor === color.value
											? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
											: "hover:ring-1 hover:ring-foreground/40",
									)}
									style={{ backgroundColor: color.value }}
								>
									{selectedColor === color.value && (
										<Check className="absolute inset-0 m-auto size-4 text-black/70" />
									)}
								</button>
							))}
						</div>
					</div>
				))}
			</div>

			<Text size="xs" tone="muted" className="mt-3">
				Cor selecionada: {selectedLabel ?? selectedColor} · aparece nos cards e tarefas
			</Text>
		</section>
	);
}
