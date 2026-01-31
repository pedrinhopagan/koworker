import { Trash2 } from "lucide-react";
import { useState } from "react";

import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDeleteProject } from "../-utils/use-delete-project";

type ProjectDeleteSectionProps = {
	projectId: string;
	projectName: string;
};

export function ProjectDeleteSection({ projectId, projectName }: ProjectDeleteSectionProps) {
	const [showConfirm, setShowConfirm] = useState(false);
	const { deleteProject, loading } = useDeleteProject({ projectId });

	const handleConfirmDelete = () => {
		deleteProject();
	};

	return (
		<div>
			<div className="border border-destructive/30 bg-destructive/5 p-4 space-y-3">
				<div className="flex items-center gap-2">
					<Trash2 className="h-4 w-4 text-destructive" />
					<Title size="sm" className="text-destructive">
						Zona de Perigo
					</Title>
				</div>

				<Text size="sm" tone="muted">
					Ao deletar este projeto, todas as tarefas associadas permanecerão no sistema mas ficarão
					sem projeto. Esta ação pode ser revertida apenas por um administrador.
				</Text>

				<Button variant="destructive" size="sm" onClick={() => setShowConfirm(true)}>
					<Trash2 className="h-4 w-4 mr-2" />
					Deletar projeto
				</Button>
			</div>

			<ConfirmDialog
				open={showConfirm}
				onClose={() => setShowConfirm(false)}
				onConfirm={handleConfirmDelete}
				title="Deletar projeto"
				description={`Tem certeza que deseja deletar o projeto "${projectName}"? Esta ação não pode ser desfeita facilmente.`}
				confirmLabel="Sim, deletar"
				cancelLabel="Cancelar"
				variant="danger"
				loading={loading}
			/>
		</div>
	);
}
