import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect } from "react";
import { useController, useForm } from "react-hook-form";
import { z } from "zod";

import type { SkillRecord, TaskSkill } from "@/types/skills";

const skillFormSchema = z.object({
	slug: z
		.string()
		.min(1, "Slug é obrigatório")
		.regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minúsculas, números e hífens"),
	title: z.string().min(1, "Título é obrigatório"),
	description: z.string().min(1, "Descrição é obrigatória"),
	content: z.string().optional(),
	icon: z.string().optional(),
	color: z.string().optional(),
});

export type SkillFormData = z.infer<typeof skillFormSchema>;

export type EditableSkill = SkillRecord;

export function useSkillForm(skill?: EditableSkill) {
	const baseMetadata = skill?.metadata ?? {};
	const defaultIcon = typeof baseMetadata.icon === "string" ? baseMetadata.icon : "FolderOpen";
	const defaultColor = typeof baseMetadata.color === "string" ? baseMetadata.color : "#94a3b8";
	const defaultTitle = skill?.name ?? "";

	const buildValues = useCallback(
		(currentSkill?: EditableSkill): SkillFormData => ({
			slug: currentSkill?.slug ?? "",
			title: currentSkill?.name ?? defaultTitle,
			description: currentSkill?.description ?? "",
			content: currentSkill?.content ?? "",
			icon:
				typeof currentSkill?.metadata?.icon === "string" ? currentSkill.metadata.icon : defaultIcon,
			color:
				typeof currentSkill?.metadata?.color === "string"
					? currentSkill.metadata.color
					: defaultColor,
		}),
		[defaultTitle, defaultIcon, defaultColor],
	);

	const {
		control,
		register,
		handleSubmit,
		formState: { errors, isDirty },
		reset,
		watch,
	} = useForm<SkillFormData>({
		resolver: zodResolver(skillFormSchema),
		defaultValues: buildValues(skill),
	});

	useEffect(() => {
		reset(buildValues(skill));
	}, [reset, skill, buildValues]);

	const iconField = useController({ control, name: "icon" });
	const colorField = useController({ control, name: "color" });

	const previewTitle = watch("title");
	const previewDescription = watch("description");
	const previewInstructions = watch("content");
	const previewIcon = iconField.field.value;
	const previewColor = colorField.field.value;
	const previewRequiresSubtaskSelection =
		baseMetadata.multiSelect === true || baseMetadata.requiresSubtaskSelection === true;

	const previewSkill: TaskSkill = {
		id: "preview",
		slug: "preview",
		label: previewTitle || "Nova skill",
		description: previewDescription || "Descrição curta da skill",
		instructions: previewInstructions || "",
		icon: previewIcon || defaultIcon,
		color: previewColor || defaultColor,
		source: skill?.sources.some((source) => source.tool === "koworker") ? "builtin" : "custom",
		sources: skill?.sources ?? [],
		primaryPath: skill?.primaryPath ?? "",
		requiresSubtaskSelection: previewRequiresSubtaskSelection,
	};

	function buildMetadata(next: SkillFormData) {
		const metadata = { ...baseMetadata } as Record<string, unknown>;

		if (next.title) {
			metadata.title = next.title;
		} else {
			delete metadata.title;
		}

		if (next.icon) {
			metadata.icon = next.icon;
		} else {
			delete metadata.icon;
		}

		if (next.color) {
			metadata.color = next.color;
		} else {
			delete metadata.color;
		}

		return metadata;
	}

	const displayTitle = skill?.name ?? "";

	return {
		register,
		handleSubmit,
		errors,
		isDirty,
		iconField,
		colorField,
		previewSkill,
		previewIcon,
		previewColor,
		defaultIcon,
		defaultColor,
		displayTitle,
		buildMetadata,
	};
}
