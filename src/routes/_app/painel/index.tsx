import { createFileRoute, Navigate } from "@tanstack/react-router";

import { useProjectFocus } from "@/hooks";

export const Route = createFileRoute("/_app/painel/")({
	component: PainelRedirect,
});

function PainelRedirect() {
	const { selectedProjectId, loading } = useProjectFocus();

	if (loading) return null;
	if (!selectedProjectId) return <Navigate to="/projetos" replace />;
	return <Navigate to="/painel/$projetoId" params={{ projetoId: selectedProjectId }} replace />;
}
