import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { FormProvider, type SubmitHandler, useForm } from "react-hook-form";

import { ProjectCreateSchema } from "@/api/schemas";
import type { ProjectCreateInput } from "@/api/schemas/projects";
import { ProjectFormBasics } from "./project-form-basics";
import { ProjectFormColors } from "./project-form-colors";
import { defaultProjectColor } from "./project-form.constants";
import { ProjectFormPreview } from "./project-form-preview";

export type ProjectFormValues = {
	name: string;
	description?: string;
	color?: string;
	mainRoute: string;
};

type ProjectFormProps = {
	mode: "create" | "edit";
	formId?: string;
	defaultValues: ProjectFormValues;
	onSubmit: (data: ProjectCreateInput) => void;
};

export function ProjectForm({ mode, formId, defaultValues, onSubmit }: ProjectFormProps) {
	const methods = useForm<ProjectFormValues>({
		resolver: zodResolver(ProjectCreateSchema),
		defaultValues,
	});

	useEffect(() => {
		methods.reset(defaultValues);
	}, [defaultValues, methods]);

	const handleSubmit: SubmitHandler<ProjectFormValues> = (data) => {
		const payload: ProjectCreateInput = {
			name: data.name.trim(),
			description: data.description?.trim() || undefined,
			color: data.color?.trim() || undefined,
			mainRoute: data.mainRoute.trim(),
		};

		onSubmit(payload);
	};

	const resolvedFormId = formId ?? "project-form";

	return (
		<FormProvider {...methods}>
			<form
				id={resolvedFormId}
				onSubmit={methods.handleSubmit(handleSubmit)}
				className="flex flex-col-reverse gap-6 h-full min-h-0 lg:grid lg:grid-cols-[2fr_3fr]"
			>
				<div className="lg:sticky lg:top-4 self-start">
					<ProjectFormPreview mode={mode} />
				</div>
				<div className="space-y-4 min-h-0 h-full overflow-y-auto pr-2 pb-6">
					<ProjectFormBasics />
					<ProjectFormColors />
				</div>
			</form>
		</FormProvider>
	);
}

export function getDefaultProjectColor() {
	return defaultProjectColor;
}
