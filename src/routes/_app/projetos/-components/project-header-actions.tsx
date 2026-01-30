import { Link } from "@tanstack/react-router";

import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";

type ProjectHeaderActionsProps = {
	mode: "create" | "edit";
	formId: string;
	submitLabel: string;
	loading: boolean;
	error: boolean;
	success?: boolean;
	cancelTo: string;
};

export function ProjectHeaderActions({
	mode,
	formId,
	submitLabel,
	loading,
	error,
	success,
	cancelTo,
}: ProjectHeaderActionsProps) {
	const primaryLabel = loading ? (mode === "create" ? "Criando..." : "Salvando...") : submitLabel;

	return (
		<div className="flex flex-col items-end gap-2">
			<div className="flex flex-wrap items-center gap-2">
				<Button type="submit" form={formId} disabled={loading}>
					{primaryLabel}
				</Button>
				<Button type="button" variant="outline" asChild>
					<Link to={cancelTo}>Voltar</Link>
				</Button>
			</div>
			{success && (
				<Text size="xs" tone="muted">
					Projeto atualizado com sucesso.
				</Text>
			)}
			{error && (
				<Text size="xs" tone="destructive">
					Erro ao salvar projeto. Tente novamente.
				</Text>
			)}
		</div>
	);
}
