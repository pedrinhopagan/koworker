import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/client";
import { EntityManagerDrawer } from "./EntityManagerDrawer";

type CategoryItem = {
	id: string;
	name: string;
	color: string;
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
	migrationHelp:
		"Se a categoria tiver tarefas associadas, escolha uma categoria de destino antes de remover.",
	hasLevel: false,
};

export function CategoryManagerDrawer() {
	const listQuery = useQuery(orpc.categories.list.queryOptions());

	return (
		<EntityManagerDrawer<CategoryItem>
			config={categoryConfig}
			hooks={orpc.categories}
			listQuery={listQuery}
		/>
	);
}
