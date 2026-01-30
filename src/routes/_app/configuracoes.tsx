import { createFileRoute } from "@tanstack/react-router";

import { Title, Text } from "@/components/typography";

export const Route = createFileRoute("/_app/configuracoes")({
	component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
	return (
		<div className="p-6">
			<Title as="h1" size="lg" className="mb-4">
				Configurações
			</Title>
			<Text tone="muted">Configurações do sistema em desenvolvimento.</Text>
		</div>
	);
}
