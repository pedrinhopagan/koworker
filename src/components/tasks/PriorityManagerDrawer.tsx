import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/client";
import { EntityManagerDrawer } from "./EntityManagerDrawer";

type PriorityItem = {
	id: string;
	name: string;
	color: string;
	level: number;
	displayOrder: number;
	createdAt: number;
	updatedAt: number | undefined;
};

const priorityConfig = {
	drawerKey: "priorities" as const,
	title: "Gerenciar prioridades",
	description: "Crie, edite, reordene e remova prioridades",
	entityName: "prioridade",
	entityNamePlural: "Prioridades",
	minOneMessage: "Você precisa ter pelo menos uma prioridade",
	migrationHelp:
		"Se a prioridade tiver tarefas associadas, escolha uma prioridade de destino antes de remover.",
	hasLevel: true,
};

export function PriorityManagerDrawer() {
	const listQuery = useQuery(orpc.priorities.list.queryOptions());

	return (
		<EntityManagerDrawer<PriorityItem>
			config={priorityConfig}
			hooks={orpc.priorities}
			listQuery={listQuery}
		/>
	);
}
