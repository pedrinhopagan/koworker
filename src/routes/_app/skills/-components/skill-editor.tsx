import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Trash2, X } from "lucide-react";
import { useEffect } from "react";
import { useController, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { orpc } from "@/client";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { IconPicker } from "@/components/ui/icon-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SkillCard } from "@/routes/_app/tarefas/$taskId/-components/skill-card";
import type { TaskSkill } from "@/types/skills";

const skillFormSchema = z.object({
	slug: z
		.string()
		.min(1, "Slug é obrigatório")
		.regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minúsculas, números e hífens"),
	name: z.string().min(1, "Título é obrigatório"),
	description: z.string().min(1, "Descrição é obrigatória"),
	content: z.string().optional(),
	icon: z.string().optional(),
	color: z.string().optional(),
});

type SkillFormData = z.infer<typeof skillFormSchema>;

interface Skill {
	id: string;
	slug: string;
	name: string;
	description: string;
	content?: string;
	metadata?: Record<string, unknown>;
	source: "builtin" | "custom";
}

interface SkillEditorProps {
	skill?: Skill;
	onClose: () => void;
	onSave: () => void;
}

export function SkillEditor({ skill, onClose, onSave }: SkillEditorProps) {
	const queryClient = useQueryClient();
	const isEditing = !!skill;
	const baseMetadata = skill?.metadata ?? {};
	const defaultIcon = typeof baseMetadata.icon === "string" ? baseMetadata.icon : "FolderOpen";
	const defaultColor = typeof baseMetadata.color === "string" ? baseMetadata.color : "#94a3b8";
	const buildValues = (currentSkill?: Skill): SkillFormData => ({
		slug: currentSkill?.slug ?? "",
		name: currentSkill?.name ?? "",
		description: currentSkill?.description ?? "",
		content: currentSkill?.content ?? "",
		icon:
			typeof currentSkill?.metadata?.icon === "string" ? currentSkill.metadata.icon : defaultIcon,
		color:
			typeof currentSkill?.metadata?.color === "string"
				? currentSkill.metadata.color
				: defaultColor,
	});

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
	const iconField = useController({ control, name: "icon" });
	const colorField = useController({ control, name: "color" });

	const skillsQueryOptions = orpc.skills.list.queryOptions();
	const skillsQueryKey = skillsQueryOptions.queryKey;

	useEffect(() => {
		reset(buildValues(skill));
	}, [skill?.id, reset]);

	const createMutation = useMutation({
		...orpc.skills.create.mutationOptions(),
		onSuccess: () => {
			toast.success("Skill criada com sucesso");
			queryClient.invalidateQueries({ queryKey: skillsQueryKey });
			queryClient.refetchQueries({ queryKey: skillsQueryKey });
			onSave();
		},
		onError: (error: Error) => {
			toast.error(`Erro ao criar skill: ${error.message}`);
		},
	});

	const updateMutation = useMutation({
		...orpc.skills.update.mutationOptions(),
		onSuccess: () => {
			toast.success("Skill atualizada com sucesso");
			queryClient.invalidateQueries({ queryKey: skillsQueryKey });
			queryClient.refetchQueries({ queryKey: skillsQueryKey });
			onSave();
		},
		onError: (error: Error) => {
			toast.error(`Erro ao atualizar skill: ${error.message}`);
		},
	});

	const deleteMutation = useMutation({
		...orpc.skills.delete.mutationOptions(),
		onSuccess: () => {
			toast.success("Skill removida com sucesso");
			queryClient.invalidateQueries({ queryKey: skillsQueryKey });
			onSave();
		},
		onError: (error: Error) => {
			toast.error(`Erro ao remover skill: ${error.message}`);
		},
	});

	const previewName = watch("name");
	const previewDescription = watch("description");
	const previewIcon = iconField.field.value;
	const previewColor = colorField.field.value;
	const previewInstructions = watch("content");
	const previewSkill: TaskSkill = {
		id: "preview",
		slug: "preview",
		label: previewName || "Nova skill",
		description: previewDescription || "Descrição curta da skill",
		instructions: previewInstructions || "",
		icon: previewIcon || defaultIcon,
		color: previewColor || defaultColor,
		source: skill?.source ?? "custom",
		requiresSubtaskSelection: baseMetadata.requiresSubtaskSelection === true,
	};

	function buildMetadata(next: SkillFormData) {
		const metadata = { ...baseMetadata } as Record<string, unknown>;
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

	const onSubmit = (data: SkillFormData) => {
		const { icon, color, ...rest } = data;
		const metadata = buildMetadata({ ...data, icon, color });

		if (isEditing) {
			const { slug: _slug, ...payload } = rest;
			updateMutation.mutate({
				id: skill.id,
				...payload,
				metadata,
			});
		} else {
			createMutation.mutate({
				...rest,
				metadata,
				source: "custom",
			});
		}
	};

	const handleDelete = () => {
		if (!skill) return;

		const confirmed = confirm(
			`Tem certeza que deseja remover a skill "${skill.name}"?\n\nEsta ação não pode ser desfeita.`
		);

		if (confirmed) {
			deleteMutation.mutate({ id: skill.id });
		}
	};

	const isSaving = createMutation.isPending || updateMutation.isPending;
	const isDeleting = deleteMutation.isPending;
	const editorTitle = isEditing ? "Editar Skill" : "Nova Skill";
	const submitLabel = isEditing ? "Salvar" : "Criar";

	return (
		<div className="h-full flex flex-col">
			<div className="flex items-center justify-between mb-6">
				<Title as="h2" size="sm">
					{editorTitle}
				</Title>
				<Button size="sm" variant="ghost" onClick={onClose}>
					<X className="h-4 w-4" />
				</Button>
			</div>

			<form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col gap-4">
				<div className="flex-1 overflow-y-auto space-y-4">
					<div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
						<div className="space-y-4">
							<div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px_120px]">
								<div className="space-y-2">
									<Label htmlFor="slug">Slug</Label>
									<Input
										id="slug"
										{...register("slug")}
										placeholder="minha-skill"
										disabled={isEditing}
										className="w-full"
									/>
									{errors.slug && (
										<Text size="xs" tone="destructive">
											{errors.slug.message}
										</Text>
									)}
									{isEditing && (
										<Text size="xs" tone="muted">
											O slug não pode ser alterado após a criação
										</Text>
									)}
								</div>
								<div className="space-y-2">
									<Label>Ícone</Label>
									<IconPicker
										value={previewIcon ?? defaultIcon}
										onChange={(value) => iconField.field.onChange(value ?? defaultIcon)}
										className="h-9 w-full"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="color">Cor</Label>
									<Input
										id="color"
										type="color"
										name={colorField.field.name}
										onBlur={colorField.field.onBlur}
										value={previewColor ?? defaultColor}
										onChange={(event) => colorField.field.onChange(event.target.value)}
										className="h-9 w-full p-1"
									/>
								</div>
							</div>
							<div className="space-y-2">
								<Label htmlFor="name">Título</Label>
								<Input
									id="name"
									{...register("name")}
									placeholder="Título da skill"
									className="w-full"
								/>
								{errors.name && (
									<Text size="xs" tone="destructive">
										{errors.name.message}
									</Text>
								)}
							</div>
							<div className="space-y-2">
								<Label htmlFor="description">Descrição</Label>
								<Textarea
									id="description"
									{...register("description")}
									placeholder="Descrição curta da skill"
									rows={3}
									className="w-full"
								/>
								{errors.description && (
									<Text size="xs" tone="destructive">
										{errors.description.message}
									</Text>
								)}
							</div>
						</div>

						<div className="space-y-2">
							<Label>Preview</Label>
							<div className="rounded-md border border-border bg-background p-2">
								<SkillCard skill={previewSkill} variant="manage" disabled />
							</div>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="content">Conteúdo (Markdown)</Label>
						<Textarea
							id="content"
							{...register("content")}
							placeholder="Conteúdo completo da skill em markdown..."
							rows={12}
							className="w-full font-mono text-sm"
						/>
						{errors.content && (
							<Text size="xs" tone="destructive">
								{errors.content.message}
							</Text>
						)}
					</div>
				</div>

				<div className="flex items-center justify-between pt-4 border-t border-border">
					<div>
						{isEditing && (
							<Button
								type="button"
								variant="destructive"
								size="sm"
								onClick={handleDelete}
								disabled={isDeleting}
							>
								<Trash2 className="h-4 w-4" />
								Remover
							</Button>
						)}
					</div>
					<div className="flex gap-2">
						<Button type="button" variant="outline" size="sm" onClick={onClose}>
							Cancelar
						</Button>
						<Button type="submit" size="sm" disabled={isSaving || !isDirty}>
							<Save className="h-4 w-4" />
							{submitLabel}
						</Button>
					</div>
				</div>
			</form>
		</div>
	);
}
