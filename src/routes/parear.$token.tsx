import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogIn, QrCode } from "lucide-react";
import { useEffect } from "react";

import { orpc, reconnectRealtime } from "@/client";
import { PageShell } from "@/components/layout/page-shell";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";

export const Route = createFileRoute("/parear/$token")({
	component: PairPage,
});

function PairPage() {
	const { token } = Route.useParams();
	const navigate = useNavigate();

	const pair = useMutation({
		...orpc.pairing.consume.mutationOptions(),
		onSuccess: () => {
			reconnectRealtime();
			void navigate({ to: "/", replace: true });
		},
	});

	useEffect(() => {
		pair.mutate({ token });
	}, [token]);

	if (pair.isError) {
		return (
			<PageShell title="Entrar pelo celular" icon={QrCode}>
				<div className="flex flex-1 items-center justify-center px-4 py-8">
					<Card className="w-full max-w-md">
						<CardHeader className="flex flex-row items-center gap-3">
							<Icon icon={QrCode} size="sm" />
							<Title size="md">Código inválido</Title>
						</CardHeader>

						<CardContent className="space-y-4">
							<Text size="sm" tone="muted">
								{pair.error.message} Peça um QR novo no computador.
							</Text>

							<Button className="w-full" onClick={() => navigate({ to: "/login" })}>
								Entrar com usuário e senha
							</Button>
						</CardContent>
					</Card>
				</div>
			</PageShell>
		);
	}

	return (
		<PageShell title="Entrar pelo celular" icon={QrCode}>
			<div className="flex flex-1 items-center justify-center px-4 py-8">
				<Card className="w-full max-w-md">
					<CardHeader className="flex flex-row items-center gap-3">
						<Icon icon={LogIn} size="sm" />
						<Title size="md">Entrando no Kowork</Title>
					</CardHeader>

					<CardContent>
						<Text size="sm" tone="muted">
							Conferindo o código e abrindo sua conta...
						</Text>
					</CardContent>
				</Card>
			</div>
		</PageShell>
	);
}
