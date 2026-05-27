import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@/client";

import type { EditableSkill, SkillFormData } from "./use-skill-form";

type UseSkillMutationsOptions = {
	skill?: EditableSkill;
	onSave: () => void;
};

export function useSkillMutations({ skill, onSave }: UseSkillMutationsOptions) {
	const queryClient = useQueryClient();
	const isEditing = Boolean(skill);
	const skillsKey = orpc.skills.list.key();

	const invalidate = () => queryClient.invalidateQueries({ queryKey: skillsKey });

	const createMutation = useMutation({
		...orpc.skills.create.mutationOptions(),
		onSuccess: () => {
			toast.success("Skill criada com sucesso");
			invalidate();
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
			invalidate();
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
			invalidate();
			onSave();
		},
		onError: (error: Error) => {
			toast.error(`Erro ao remover skill: ${error.message}`);
		},
	});

	function saveSkill(data: SkillFormData, metadata: Record<string, unknown>) {
		if (isEditing && skill) {
			updateMutation.mutate({
				path: skill.primaryPath,
				description: data.description,
				content: data.content,
				metadata,
			});
			return;
		}

		createMutation.mutate({
			slug: data.slug,
			description: data.description,
			content: data.content,
			metadata,
		});
	}

	function removeSkill() {
		if (!skill) {
			return;
		}
		deleteMutation.mutate({ path: skill.primaryPath });
	}

	return {
		createMutation,
		updateMutation,
		deleteMutation,
		saveSkill,
		removeSkill,
		isEditing,
		isSaving: createMutation.isPending || updateMutation.isPending,
		isDeleting: deleteMutation.isPending,
	};
}
