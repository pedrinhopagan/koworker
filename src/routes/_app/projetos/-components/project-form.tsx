import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { FormProvider, type SubmitHandler, useForm } from "react-hook-form";

import { ProjectCreateSchema } from "@/api/schemas";
import type { ProjectCreateInput } from "@/api/schemas/projects";
import { defaultProjectColor } from "@/constants/colors";
import { ProjectFormBasics } from "./project-form-basics";
import { ProjectFormColors } from "./project-form-colors";
import { ProjectFormPreview } from "./project-form-preview";
import { ProjectDeleteSection } from "./project-delete-section";
import { ProjectFormRoutes } from "./ProjectFormRoutes";

export type ProjectFormValues = {
	name: string;
	description?: string;
	color?: string;
	mainRoute: string;
};

type ProjectRouteItem = {
	id: string;
	projectId: string;
	name: string;
	route: string;
	icon?: string;
	command?: string;
	displayOrder: number;
};

type ProjectFormProps = {
	mode: "create" | "edit";
	formId?: string;
	defaultValues?: ProjectFormValues;
	onSubmit: (data: ProjectCreateInput) => void;
	projectId?: string;
	routes?: ProjectRouteItem[];
	onRouteChange?: () => void;
};

export function ProjectForm({
	mode,
	formId,
	defaultValues,
	onSubmit,
	projectId,
	routes,
	onRouteChange,
}: ProjectFormProps) {
	// const { projetoId } = Route.useParams();

	const methods = useForm<ProjectFormValues>({
		resolver: zodResolver(ProjectCreateSchema),
		values: {
			name: "",
			description: "",
			color: defaultProjectColor,
			mainRoute: "",
		},
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
	const projectName = methods.getValues("name");

	return (
		<FormProvider {...methods}>
			<form
				id={resolvedFormId}
				onSubmit={methods.handleSubmit(handleSubmit)}
				className="flex flex-col-reverse gap-6 h-full min-h-0 md:grid md:grid-cols-[2fr_3fr]"
			>
				<div className="lg:sticky lg:top-4 self-start">
					<ProjectFormPreview mode={mode} />
				</div>
				<div className="space-y-4 min-h-0 h-full overflow-y-auto pr-2 pb-6">
					<ProjectFormBasics />
					<ProjectFormColors />
					{mode === "edit" && projectId && projectName && (
						<>
							<ProjectFormRoutes
								projectId={projectId}
								routes={routes}
								onRouteChange={onRouteChange}
							/>
							<ProjectDeleteSection projectId={projectId} projectName={projectName} />
						</>
					)}
				</div>
			</form>
		</FormProvider>
	);
}

export function getDefaultProjectColor() {
	return defaultProjectColor;
}
