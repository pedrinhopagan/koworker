import { useNavigate } from "@tanstack/react-router";
import { FolderOpen } from "lucide-react";
import { useState } from "react";

import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProjectFormProps = {
	onSubmit: (data: {
		name: string;
		description?: string;
		color: string;
		mainRoute: string;
	}) => void;
	loading: boolean;
	error: boolean;
};

const cores = [
	{ value: "#10B981", label: "Verde" },
	{ value: "#3B82F6", label: "Azul" },
	{ value: "#F59E0B", label: "Amarelo" },
	{ value: "#EF4444", label: "Vermelho" },
	{ value: "#8B5CF6", label: "Roxo" },
	{ value: "#EC4899", label: "Rosa" },
];

export function ProjectForm({ onSubmit, loading, error }: ProjectFormProps) {
	const navigate = useNavigate();
	const [nome, setNome] = useState("");
	const [descricao, setDescricao] = useState("");
	const [pasta, setPasta] = useState("");
	const [cor, setCor] = useState("#10B981");

	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		if (!nome.trim() || !pasta.trim()) return;

		onSubmit({
			name: nome.trim(),
			description: descricao.trim() || undefined,
			color: cor,
			mainRoute: pasta.trim(),
		});
	};

	return (
		<Card>
			<CardHeader className="space-y-1">
				<div className="flex items-center gap-3">
					<div
						className="flex size-10 items-center justify-center rounded-md"
						style={{ backgroundColor: `${cor}20` }}
					>
						<FolderOpen className="size-5" style={{ color: cor }} />
					</div>
					<div>
						<Title size="sm">Dados do projeto</Title>
						<Text size="sm" tone="muted">
							Preencha as informações principais
						</Text>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<form className="grid gap-5" onSubmit={handleSubmit}>
					<div className="grid gap-2">
						<Label htmlFor="nome">Nome do projeto</Label>
						<Input
							id="nome"
							placeholder="Ex: WorkOpilot"
							value={nome}
							onChange={(event) => setNome(event.target.value)}
							required
						/>
					</div>

					<div className="grid gap-2">
						<Label htmlFor="descricao">Descrição (opcional)</Label>
						<Input
							id="descricao"
							placeholder="Uma breve descrição do projeto"
							value={descricao}
							onChange={(event) => setDescricao(event.target.value)}
						/>
					</div>

					<div className="grid gap-2">
						<Label htmlFor="pasta">Pasta do projeto</Label>
						<Input
							id="pasta"
							placeholder="/home/usuario/projetos/meu-projeto"
							value={pasta}
							onChange={(event) => setPasta(event.target.value)}
							required
						/>
						<Text size="xs" tone="muted">
							Caminho absoluto para a pasta raiz do projeto
						</Text>
					</div>

					<div className="grid gap-2">
						<Label>Cor do projeto</Label>
						<div className="flex flex-wrap gap-2">
							{cores.map((c) => (
								<button
									key={c.value}
									type="button"
									onClick={() => setCor(c.value)}
									className={`size-8 rounded-md border-2 transition ${
										cor === c.value ? "border-foreground" : "border-transparent"
									}`}
									style={{ backgroundColor: c.value }}
									title={c.label}
								/>
							))}
						</div>
					</div>

					<div className="flex gap-3 pt-2">
						<Button type="submit" disabled={loading}>
							{loading ? "Criando..." : "Criar projeto"}
						</Button>
						<Button type="button" variant="outline" onClick={() => navigate({ to: "/projetos" })}>
							Cancelar
						</Button>
					</div>

					{error && (
						<Text size="sm" tone="destructive">
							Erro ao criar projeto. Tente novamente.
						</Text>
					)}
				</form>
			</CardContent>
		</Card>
	);
}
