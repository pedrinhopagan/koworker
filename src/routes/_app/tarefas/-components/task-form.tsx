import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategorySelect } from "@/components/tasks/CategorySelect";
import { PrioritySelect } from "@/components/tasks/PrioritySelect";

type TaskFormProps = {
	projectId: string | undefined;
	onSubmit: (data: {
		projectId: string;
		title: string;
		categoryId: string;
		priorityId: string;
	}) => void;
	loading: boolean;
};

export function TaskForm({ projectId, onSubmit, loading }: TaskFormProps) {
	const [titulo, setTitulo] = useState("");
	const [categoriaId, setCategoriaId] = useState<string | null>(null);
	const [prioridadeId, setPrioridadeId] = useState<string | null>(null);

	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		if (!titulo.trim() || !categoriaId || !prioridadeId || !projectId) return;

		onSubmit({
			projectId,
			title: titulo.trim(),
			categoryId: categoriaId,
			priorityId: prioridadeId,
		});

		setTitulo("");
	};

	return (
		<form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
			<div className="flex-1">
				<Input
					placeholder="Nova tarefa..."
					value={titulo}
					onChange={(event) => setTitulo(event.target.value)}
					className="h-10"
				/>
			</div>

			<CategorySelect
				value={categoriaId}
				onValueChange={(id) => setCategoriaId(id)}
				disabled={loading}
			/>

			<PrioritySelect
				value={prioridadeId}
				onValueChange={(id) => setPrioridadeId(id)}
				disabled={loading}
			/>

			<Button type="submit" disabled={loading}>
				<Plus className="mr-1 size-4" />
				Adicionar
			</Button>
		</form>
	);
}
