import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FolderTree, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { PageShell } from "@/components/layout/page-shell";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { AGENT_TOOL_LABEL, AGENT_TOOLS } from "@/constants/agents";
import { useAgentPaths } from "@/hooks/use-agent-paths";
import { isTauri, pickProjectFolder } from "@/lib/tauri";
import type { AgentSource } from "@/types/agents";

export const Route = createFileRoute("/_app/fontes-agents")({
	component: FontesAgentsPage,
});

function FontesAgentsPage() {
	const navigate = useNavigate();
	const { paths, loading, addPath, adding, removePath } = useAgentPaths();

	const canPick = isTauri();
	const [tool, setTool] = useState<AgentSource["tool"]>("claude-code");
	const [path, setPath] = useState("");
	const [picking, setPicking] = useState(false);

	function handleAdd() {
		const trimmed = path.trim();
		if (!trimmed) return;
		addPath({ tool, path: trimmed });
		setPath("");
	}

	async function handlePick() {
		if (!canPick || picking) return;
		setPicking(true);
		const selected = await pickProjectFolder(path.trim() || undefined);
		if (selected) setPath(selected);
		setPicking(false);
	}

	return (
		<PageShell
			title="Fontes de agents"
			description="Diretórios extras do computador de onde ler agents, somados às pastas padrão dos agents"
			icon={FolderTree}
			onBack={() => navigate({ to: "/configuracoes" })}
			contentClassName="min-h-0 flex-1 overflow-y-auto px-4 pb-8"
		>
			<div className="mx-auto w-full max-w-2xl space-y-6">
				<section className="space-y-2">
					<Title as="div" size="sm">
						Adicionar caminho
					</Title>
					<div className="flex flex-col gap-2 border border-border bg-card/50 p-3">
						<div className="flex items-center gap-2">
							<Select value={tool} onValueChange={(value) => setTool(value as AgentSource["tool"])}>
								<SelectTrigger className="h-9 w-44 shrink-0">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{AGENT_TOOLS.map((entry) => (
										<SelectItem key={entry} value={entry}>
											{AGENT_TOOL_LABEL[entry]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Input
								value={path}
								onChange={(event) => setPath(event.target.value)}
								placeholder="Caminho absoluto da pasta de agents"
								className="h-9 flex-1 font-mono"
								onKeyDown={(event) => {
									if (event.key === "Enter") {
										event.preventDefault();
										handleAdd();
									}
								}}
							/>
							{canPick && (
								<Button
									type="button"
									variant="outline"
									onClick={handlePick}
									disabled={picking}
									className="h-9 shrink-0 px-3"
								>
									...
								</Button>
							)}
						</div>
						<Button
							type="button"
							onClick={handleAdd}
							disabled={adding || !path.trim()}
							className="self-end"
						>
							<Plus className="mr-2 size-4" />
							Adicionar
						</Button>
					</div>
					<Text size="xs" tone="muted">
						Aponte para a pasta que contém os arquivos .md dos agents, como
						<span className="font-mono"> ~/.claude/agents</span>.
					</Text>
				</section>

				<section className="space-y-2">
					<Title as="div" size="sm">
						Caminhos cadastrados
					</Title>
					{loading ? (
						<Text size="sm" tone="muted">
							Carregando...
						</Text>
					) : paths.length === 0 ? (
						<Text size="sm" tone="muted">
							Nenhum caminho extra. Apenas as pastas padrão dos agents são lidas.
						</Text>
					) : (
						<div className="divide-y divide-border border border-border bg-card">
							{paths.map((entry) => (
								<div key={entry.id} className="flex items-center gap-3 px-3 py-2">
									<Chip size="xs" variant="outline" className="shrink-0">
										{AGENT_TOOL_LABEL[entry.tool as AgentSource["tool"]] ?? entry.tool}
									</Chip>
									<span className="min-w-0 flex-1 truncate font-mono text-xs">{entry.path}</span>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										onClick={() => removePath(entry.id)}
										title="Remover caminho"
										aria-label="Remover caminho"
										className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
									>
										<Trash2 className="size-3.5" />
									</Button>
								</div>
							))}
						</div>
					)}
				</section>
			</div>
		</PageShell>
	);
}
