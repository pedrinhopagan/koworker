import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { orpc } from "@/client";
import { CustomSelect } from "@/components/ui/custom-select";
import { PROMPT_TEMPLATES, type PromptTemplateSlug } from "@/constants/prompt-templates";
import { EntityManagerDrawer } from "./EntityManagerDrawer";

type CategoryItem = {
	id: string;
	name: string;
	color: string;
	// Texto livre no banco; o conjunto finito vive na boundary zod. Um slug desconhecido só cai no
	// item "Sem estrutura" do select — não quebra.
	structureSlug: string | null;
	displayOrder: number;
	createdAt: number;
	updatedAt: number | undefined;
};

const categoryConfig = {
	drawerKey: "categories" as const,
	title: "Gerenciar categorias",
	description: "Crie, edite, reordene e remova categorias",
	entityName: "categoria",
	entityNamePlural: "Categorias",
	minOneMessage: "Você precisa ter pelo menos uma categoria",
	hasLevel: false,
};

// Sentinela pro item "sem estrutura": Radix Select não aceita value vazio, então mapeamos de/para null.
const NO_STRUCTURE = "__none__";

const structureItems = [
	{ id: NO_STRUCTURE, name: "Sem estrutura" },
	...PROMPT_TEMPLATES.map((template) => ({ id: template.slug, name: template.label })),
];

function CategoryStructureSelect({ category }: { category: CategoryItem }) {
	const queryClient = useQueryClient();
	const updateMutation = useMutation({
		...orpc.categories.update.mutationOptions(),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: orpc.categories.list.queryOptions().queryKey }),
	});

	return (
		<CustomSelect
			items={structureItems}
			value={category.structureSlug ?? NO_STRUCTURE}
			onValueChange={(value) =>
				updateMutation.mutate({
					id: category.id,
					structureSlug: value === NO_STRUCTURE ? null : (value as PromptTemplateSlug),
				})
			}
			size="sm"
			fitContent
			triggerClassName="min-w-32"
			label="Estrutura"
			renderItem={(item) => (
				<span className="block truncate px-3 py-2 text-sm text-foreground">{item.name}</span>
			)}
		/>
	);
}

export function CategoryManagerDrawer() {
	const listQuery = useQuery(orpc.categories.list.queryOptions());

	return (
		<EntityManagerDrawer<CategoryItem>
			config={categoryConfig}
			hooks={orpc.categories}
			listQuery={listQuery}
			renderItemExtra={(category) => <CategoryStructureSelect category={category} />}
		/>
	);
}
