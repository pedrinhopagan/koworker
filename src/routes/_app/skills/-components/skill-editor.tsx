import { Save, Trash2, X } from "lucide-react";

import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { IconSelector } from "@/components/ui/icon-selector";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type EditableSkill, type SkillFormData, useSkillForm } from "../-utils/use-skill-form";
import { useSkillMutations } from "../-utils/use-skill-mutations";
import { SkillPreviewPanel } from "./skill-preview-panel";

interface SkillEditorProps {
	skill?: EditableSkill;
	onClose: () => void;
	onSave: () => void;
}

export function SkillEditor({ skill, onClose, onSave }: SkillEditorProps) {
	const {
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
	} = useSkillForm(skill);

	const { saveSkill, removeSkill, isEditing, isSaving, isDeleting } = useSkillMutations({
		skill,
		onSave,
	});

	const editorTitle = isEditing ? "Editar Skill" : "Nova Skill";
	const submitLabel = isEditing ? "Salvar" : "Criar";

	const onSubmit = (data: SkillFormData) => {
		saveSkill(data, buildMetadata(data));
	};

	function handleDelete() {
		if (!skill) {
			return;
		}

		const confirmed = confirm(
			`Tem certeza que deseja remover a skill "${displayTitle}"?\n\nEsta ação não pode ser desfeita.`,
		);

		if (confirmed) {
			removeSkill();
		}
	}

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
									<IconSelector
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
								<Label htmlFor="title">Título</Label>
								<Input
									id="title"
									{...register("title")}
									placeholder="Título da skill"
									className="w-full"
								/>
								{errors.title && (
									<Text size="xs" tone="destructive">
										{errors.title.message}
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

						<SkillPreviewPanel skill={previewSkill} />
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
