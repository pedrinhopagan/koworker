import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc, type RouterInputs } from "@/client";

export function useSkillMutations() {
	const queryClient = useQueryClient();
	const invalidateList = () => queryClient.invalidateQueries({ queryKey: orpc.skills.list.key() });
	const invalidateAll = () => {
		invalidateList();
		queryClient.invalidateQueries({ queryKey: orpc.skills.get.key() });
	};

	const updateMutation = useMutation({
		...orpc.skills.update.mutationOptions(),
		onError: (error: Error) => toast.error(`Erro ao salvar skill: ${error.message}`),
	});

	const renameMutation = useMutation({
		...orpc.skills.rename.mutationOptions(),
		onSuccess: () => {
			invalidateAll();
			toast.success("Skill renomeada");
		},
		onError: (error: Error) => toast.error(`Erro ao renomear skill: ${error.message}`),
	});

	const standardizeMutation = useMutation({
		...orpc.skills.standardize.mutationOptions(),
		onSuccess: (result) => {
			invalidateAll();
			const parts = [
				result.updated > 0 &&
					`${result.updated} ${result.updated === 1 ? "cópia sobrescrita" : "cópias sobrescritas"}`,
				result.created > 0 &&
					`${result.created} ${result.created === 1 ? "cópia criada" : "cópias criadas"}`,
			].filter(Boolean);
			toast.success(
				parts.length > 0
					? `Skill replicada: ${parts.join(" e ")}`
					: "Todas as cópias já estavam iguais",
			);
		},
		onError: (error: Error) => toast.error(`Erro ao replicar: ${error.message}`),
	});

	const deleteMutation = useMutation({
		...orpc.skills.delete.mutationOptions(),
		onSuccess: () => {
			invalidateAll();
			toast.success("Cópia removida");
		},
		onError: (error: Error) => toast.error(`Erro ao remover skill: ${error.message}`),
	});

	const deleteAllMutation = useMutation({
		...orpc.skills.deleteAll.mutationOptions(),
		onSuccess: (result) => {
			invalidateAll();
			toast.success(
				`Skill removida de ${result.removed} ${result.removed === 1 ? "fonte" : "fontes"}. Backup em ${result.backupPath}`,
			);
		},
		onError: (error: Error) => toast.error(`Erro ao remover skill: ${error.message}`),
	});

	return {
		renameSkill: async (input: RouterInputs["skills"]["rename"]) =>
			await renameMutation.mutateAsync(input),
		renaming: renameMutation.isPending,
		updateContent: async (input: RouterInputs["skills"]["update"]) => {
			const result = await updateMutation.mutateAsync(input);
			queryClient.setQueryData(
				orpc.skills.get.queryOptions({
					input: { slug: input.slug, projectName: input.projectName },
				}).queryKey,
				(current) => {
					if (!current) {
						return current;
					}
					const contentHashes = current.variants.map((variant) =>
						variant.path === input.variantPath ? result.contentHash : variant.contentHash,
					);
					const groups = [...new Set(contentHashes)];
					const updatedDir = current.variants.find(
						(variant) => variant.path === input.variantPath,
					)?.dir;
					const primaryUpdated = current.primaryPath === input.variantPath;
					const primaryVariant = current.variants.find(
						(variant) => variant.path === current.primaryPath,
					);
					const title = typeof input.metadata.title === "string" ? input.metadata.title.trim() : "";
					return {
						...current,
						...(primaryUpdated && {
							name: title || primaryVariant?.name || input.slug,
							description: input.description,
							content: input.content,
							metadata: input.metadata,
						}),
						conflict: groups.length > 1,
						sources: current.sources.map((source) =>
							source.path === updatedDir
								? { ...source, hash: result.skillHash, contentHash: result.contentHash }
								: source,
						),
						variants: current.variants.map((variant) => {
							const contentHash =
								variant.path === input.variantPath ? result.contentHash : variant.contentHash;
							if (variant.path !== input.variantPath) {
								return { ...variant, group: groups.indexOf(contentHash) };
							}
							return {
								...variant,
								description: input.description,
								content: input.content,
								metadata: input.metadata,
								hash: result.skillHash,
								skillHash: result.skillHash,
								contentHash,
								files: result.files,
								group: groups.indexOf(contentHash),
							};
						}),
					};
				},
			);
			invalidateList();
			return result;
		},
		standardize: async (input: RouterInputs["skills"]["standardize"]) =>
			await standardizeMutation.mutateAsync(input),
		standardizing: standardizeMutation.isPending,
		removeSkill: (input: RouterInputs["skills"]["delete"]) => deleteMutation.mutate(input),
		removeAllSkill: (input: RouterInputs["skills"]["deleteAll"], onSuccess?: () => void) =>
			deleteAllMutation.mutate(input, { onSuccess }),
		removing: deleteMutation.isPending || deleteAllMutation.isPending,
	};
}
