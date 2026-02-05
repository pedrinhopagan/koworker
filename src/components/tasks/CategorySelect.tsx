import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/client";
import { CategoryManagerDrawer } from "./CategoryManagerDrawer";
import { EntityChip, EntitySelect } from "./EntitySelect";

export type Category = {
	id: string;
	name: string;
	color: string | null;
};

export type CategorySelectProps = {
	value: string | null;
	onValueChange: (categoryId: string, category: Category) => void;
	disabled?: boolean;
	placeholder?: string;
	triggerClassName?: string;
	upperLabel?: boolean;
};

export type CategoryChipProps = {
	category: Category | null;
	size?: "sm" | "md";
	placeholder?: string;
};

export function CategoryChip({
	category,
	size = "md",
	placeholder = "Categoria",
}: CategoryChipProps) {
	return <EntityChip entity={category} size={size} placeholder={placeholder} />;
}

const categorySelectConfig = {
	entityName: "categoria",
	entityNamePlural: "categorias",
	manageActionId: "__manage_category__",
	manageDrawerKey: "categories" as const,
	label: "Categoria",
	placeholder: "Categoria",
	loadErrorMessage: "Não foi possível carregar categorias",
	emptyMessage: "Nenhuma categoria",
	manageLabel: "Gerenciar categorias",
	contentMinWidth: "min-w-[180px]",
};

export function CategorySelect({
	value,
	onValueChange,
	disabled = false,
	placeholder = "Categoria",
	triggerClassName,
	upperLabel = false,
}: CategorySelectProps) {
	const listQuery = useQuery(orpc.categories.list.queryOptions());

	return (
		<EntitySelect<Category>
			config={{ ...categorySelectConfig, placeholder }}
			listQuery={listQuery}
			value={value}
			onValueChange={onValueChange}
			disabled={disabled}
			triggerClassName={triggerClassName}
			upperLabel={upperLabel}
			managerDrawer={<CategoryManagerDrawer />}
		/>
	);
}
