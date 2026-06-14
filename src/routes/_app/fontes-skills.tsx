import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FolderTree, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { PageShell } from "@/components/layout/page-shell";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { SKILL_TOOL_LABEL, SKILL_TOOLS } from "@/constants/skills";
import { useSkillPaths } from "@/hooks/use-skill-paths";
import { isTauri, pickProjectFolder } from "@/lib/tauri";
import type { SkillSource } from "@/types/skills";

export const Route = createFileRoute("/_app/fontes-skills")({
	component: FontesSkillsPage,
});

function FontesSkillsPage() {
	const navigate = useNavigate();
	const { paths, loading, addPath, adding, removePath } = useSkillPaths();

	const canPick = isTauri();
	const [tool, setTool] = useState<SkillSource["tool"]>("claude-code");
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
			title="Fontes de skills"
			description="Diretórios extras do computador de onde ler skills, somados às pastas padrão dos agents"
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
							<Select value={tool} onValueChange={(value) => setTool(value as SkillSource["tool"])}>
								<SelectTrigger className="h-9 w-44 shrink-0">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{SKILL_TOOLS.map((entry) => (
										<SelectItem key={entry} value={entry}>
											{SKILL_TOOL_LABEL[entry]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Input
								value={path}
								onChange={(event) => setPath(event.target.value)}
								placeholder="Caminho absoluto da pasta de skills"
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
						Aponte para a pasta que contém as subpastas das skills (cada uma com seu SKILL.md), como
						<span className="font-mono"> ~/.claude/skills</span>.
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
										{SKILL_TOOL_LABEL[entry.tool as SkillSource["tool"]] ?? entry.tool}
									</Chip>
									<span className="min-w-0 flex-1 truncate font-mono text-xs">{entry.path}</span>
									<Tooltip label="Remover caminho">
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											onClick={() => removePath(entry.id)}
											aria-label="Remover caminho"
											className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
										>
											<Trash2 className="size-3.5" />
										</Button>
									</Tooltip>
								</div>
							))}
						</div>
					)}
				</section>
			</div>
		</PageShell>
	);
}
