import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Plus } from "lucide-react";
import { type ComponentProps, useState } from "react";
import { Controller, type SubmitHandler, useForm } from "react-hook-form";
import { z } from "zod";

import { orpc, type RouterOutputs } from "@/client";
import { CategorySelect } from "@/components/tasks/CategorySelect";
import { PrioritySelect } from "@/components/tasks/PrioritySelect";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useSelectedProjectStore } from "@/stores/selected-project";

const InlineTaskCreateFormSchema = z.object({
	title: z.string().trim().min(1, "Título obrigatório"),
	categoryId: z.string().min(1, "Categoria obrigatória"),
	priorityId: z.string().min(1, "Prioridade obrigatória"),
});

export type InlineTaskCreateFormValues = z.infer<typeof InlineTaskCreateFormSchema>;

export type InlineTaskCreateFormSubmitInput = InlineTaskCreateFormValues & {
	projectId: string;
};

export type InlineTaskCreateFormProps = {
	/**
	 * Optional projectId supplied by the caller.
	 * If the selected-project store already has a projectId, the store value takes precedence.
	 */
	projectId?: string;
	onSubmit: (data: InlineTaskCreateFormSubmitInput) => void;
	loading?: boolean;
	className?: string;
	autoFocus?: boolean;
	/**
	 * Reset behavior after a successful submit.
	 * - title: clears only the title (keeps category/priority)
	 * - all: clears all fields
	 * - none: keeps all values
	 */
	resetMode?: "title" | "all" | "none";
	inputProps?: Omit<ComponentProps<typeof Input>, "value" | "onChange" | "defaultValue" | "name">;
};

type Project = RouterOutputs["projects"]["list"][number];

function ProjectChip({ project }: { project: Project | null }) {
	const color = project?.color ?? "#6b7280";
	const label = project?.name ?? "Projeto";

	return (
		<span className={cn("inline-flex items-center gap-2", "text-sm")}>
			<span className="size-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
			<span className="truncate text-foreground">{label}</span>
		</span>
	);
}

export function InlineTaskCreateForm({
	projectId,
	onSubmit,
	loading = false,
	className,
	autoFocus,
	resetMode = "title",
	inputProps,
}: InlineTaskCreateFormProps) {
	// IMPORTANT: only READ from the store here (no writes).
	// Rules implemented:
	// - If the store has projectId: submit uses the store and we don't render a project select.
	// - If the store does NOT have projectId: we render a project select and selecting a project
	//   triggers auto-submit, without changing the store.
	const storeProjectId = useSelectedProjectStore((s) => s.selectedProjectId);

	const projectsQuery = useQuery(orpc.projects.list.queryOptions());
	const projects = (projectsQuery.data ?? []) as Project[];

	const projectsLoadError = projectsQuery.isError ? "Não foi possível carregar projetos" : null;

	const [transientProjectId, setTransientProjectId] = useState<string | null>(null);

	const effectiveProjectId = storeProjectId ?? projectId ?? transientProjectId;
	const shouldRenderProjectSelect = !storeProjectId && !projectId;

	const selectedProject =
		effectiveProjectId && projects.length > 0
			? (projects.find((p) => p.id === effectiveProjectId) ?? null)
			: null;

	const {
		register,
		handleSubmit,
		control,
		reset,
		resetField,
		formState: { errors },
	} = useForm<InlineTaskCreateFormValues>({
		resolver: zodResolver(InlineTaskCreateFormSchema),
		defaultValues: {
			title: "",
			categoryId: "",
			priorityId: "",
		},
	});

	const fieldsDisabled = loading;
	const submitDisabled = loading || !effectiveProjectId;

	const submitWithProjectId =
		(pid: string): SubmitHandler<InlineTaskCreateFormValues> =>
		(values) => {
			onSubmit({
				projectId: pid,
				title: values.title.trim(),
				categoryId: values.categoryId,
				priorityId: values.priorityId,
			});

			if (resetMode === "all") {
				reset();
			} else if (resetMode === "title") {
				resetField("title", { defaultValue: "" });
			}
		};

	return (
		<form
			onSubmit={handleSubmit((values) => {
				if (!effectiveProjectId) return;
				submitWithProjectId(effectiveProjectId)(values);
			})}
			className={className ?? "flex flex-wrap items-end gap-3"}
		>
			<div className="flex-1 min-w-55">
				<Input
					placeholder="Nova tarefa..."
					autoFocus={autoFocus}
					disabled={fieldsDisabled}
					aria-invalid={!!errors.title}
					{...inputProps}
					{...register("title")}
					className={`h-10 ${inputProps?.className ?? ""}`}
				/>
				{errors.title?.message && (
					<Text size="xs" tone="destructive" className="mt-1">
						{errors.title.message}
					</Text>
				)}
			</div>

			<Controller
				control={control}
				name="categoryId"
				render={({ field }) => (
					<div className="grid gap-1">
						<CategorySelect
							value={field.value ? field.value : null}
							onValueChange={(id) => field.onChange(id ?? "")}
							disabled={fieldsDisabled}
						/>
						{errors.categoryId?.message && (
							<Text size="xs" tone="destructive">
								{errors.categoryId.message}
							</Text>
						)}
					</div>
				)}
			/>

			<Controller
				control={control}
				name="priorityId"
				render={({ field }) => (
					<div className="grid gap-1">
						<PrioritySelect
							value={field.value ? field.value : null}
							onValueChange={(id) => field.onChange(id ?? "")}
							disabled={fieldsDisabled}
						/>
						{errors.priorityId?.message && (
							<Text size="xs" tone="destructive">
								{errors.priorityId.message}
							</Text>
						)}
					</div>
				)}
			/>

			{shouldRenderProjectSelect && (
				<div className="grid gap-1">
					<CustomSelect
						items={projects}
						value={transientProjectId ?? undefined}
						onValueChange={(newValue) => {
							setTransientProjectId(newValue);
							// Auto-submit when a project is selected (without touching the store).
							handleSubmit(submitWithProjectId(newValue))();
						}}
						disabled={fieldsDisabled}
						loading={projectsQuery.isLoading}
						error={projectsLoadError}
						emptyMessage={projectsLoadError ? "" : "Nenhum projeto"}
						variant="default"
						size="md"
						label="Projeto"
						renderTrigger={() => (
							<>
								<ProjectChip project={selectedProject} />
								<ChevronDown className="size-4 text-muted-foreground ml-1" />
							</>
						)}
						renderItem={(item, isSelected) => {
							const color = item.color ?? "#6b7280";

							return (
								<div
									className={cn(
										"w-full px-3 py-2 flex items-center gap-2",
										"transition-all duration-150 ease-out",
										isSelected && "font-medium",
									)}
									style={{
										color: isSelected ? (item.color ?? undefined) : undefined,
										borderLeft: isSelected ? `2px solid ${color}` : "2px solid transparent",
									}}
								>
									<span
										className="size-2 rounded-full shrink-0"
										style={{ backgroundColor: color }}
									/>
									<span className={cn("flex-1 text-sm truncate")}>{item.name}</span>

									{isSelected && <Check className="size-4 ml-auto shrink-0" style={{ color }} />}
								</div>
							);
						}}
						triggerStyle={{
							boxShadow: `0 0 0 1px ${selectedProject?.color ?? "#6b7280"}30`,
						}}
						triggerClassName={cn("gap-1 min-w-[160px]")}
						contentClassName="min-w-[220px]"
					/>
					{projectsLoadError ? (
						<Text size="xs" tone="destructive">
							{projectsLoadError}
						</Text>
					) : transientProjectId ? null : (
						<Text size="xs" tone="muted">
							Selecione um projeto para adicionar tarefas
						</Text>
					)}
				</div>
			)}

			<div className="grid gap-1">
				<Button type="submit" disabled={submitDisabled}>
					<Plus className="mr-1 size-4" />
					Adicionar
				</Button>
			</div>
		</form>
	);
}
