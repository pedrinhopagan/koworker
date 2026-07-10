import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";

import { PageShell } from "@/components/layout/page-shell";
import { SourcePathsSection } from "@/components/settings/source-paths-section";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CustomSelect } from "@/components/ui/custom-select";
import { Textarea } from "@/components/ui/textarea";
import { AGENT_TOOL_LABEL, AGENT_TOOLS } from "@/constants/agents";
import { SKILL_TOOL_LABEL, SKILL_TOOLS } from "@/constants/skills";
import {
	matchTerminalPreset,
	TERMINAL_MULTIPLEXER_LABEL,
	TERMINAL_MULTIPLEXERS,
	TERMINAL_PRESETS,
	type TerminalPresetId,
} from "@/constants/terminal";
import { useAgentPaths } from "@/hooks/use-agent-paths";
import { useSkillPaths } from "@/hooks/use-skill-paths";
import { useSystemSettings } from "@/hooks/use-system-settings";

export const Route = createFileRoute("/_app/sistema")({
	component: SistemaPage,
});

function SistemaPage() {
	const navigate = useNavigate();
	const { settings, loading, save, saving } = useSystemSettings();
	const agentPaths = useAgentPaths();
	const skillPaths = useSkillPaths();

	const [basePath, setBasePath] = useState("");
	const [template, setTemplate] = useState("");

	useEffect(() => {
		if (!settings) return;
		setBasePath(settings.projectsBasePath);
		setTemplate(settings.terminalTemplate);
	}, [settings]);

	const presetValue = matchTerminalPreset(template) ?? "custom";

	function selectPreset(preset: TerminalPresetId) {
		const next = TERMINAL_PRESETS[preset].template;
		setTemplate(next);
		save({ terminalTemplate: next });
	}

	return (
		<PageShell
			title="Sistema"
			description="Terminal, multiplexador, pasta base e fontes de agents/skills"
			icon={SlidersHorizontal}
			onBack={() => navigate({ to: "/configuracoes" })}
			contentClassName="min-h-0 flex-1 overflow-y-auto px-4 pb-8"
		>
			<div className="mx-auto w-full max-w-2xl space-y-8">
				{loading || !settings ? (
					<Text size="sm" tone="muted">
						Carregando...
					</Text>
				) : (
					<>
						<section className="space-y-2">
							<Title as="div" size="sm">
								Pasta base de projetos
							</Title>
							<div className="flex items-center gap-2">
								<Input
									value={basePath}
									onChange={(event) => setBasePath(event.target.value)}
									placeholder="Caminho absoluto onde os projetos vivem"
									className="h-9 flex-1 font-mono"
								/>
								<Button
									type="button"
									onClick={() => save({ projectsBasePath: basePath.trim() })}
									disabled={saving || !basePath.trim() || basePath === settings.projectsBasePath}
									className="h-9 shrink-0"
								>
									Salvar
								</Button>
							</div>
							<Text size="xs" tone="muted">
								Raiz assumida ao escolher a pasta de um projeto e ao validar acessos ao disco.
							</Text>
						</section>

						<section className="space-y-2">
							<Title as="div" size="sm">
								Emulador de terminal
							</Title>
							<CustomSelect
								items={[
									...(Object.keys(TERMINAL_PRESETS) as TerminalPresetId[]).map((id) => ({
										id,
										label: TERMINAL_PRESETS[id].label,
									})),
									{ id: "custom", label: "Personalizado" },
								]}
								value={presetValue}
								onValueChange={(value) => {
									if (value !== "custom") selectPreset(value as TerminalPresetId);
								}}
								renderItem={(item) => item.label}
								triggerClassName="h-9 w-full"
							/>
							<Textarea
								value={template}
								onChange={(event) => setTemplate(event.target.value)}
								className="font-mono text-xs"
								rows={2}
							/>
							<div className="flex items-center justify-between gap-2">
								<Text size="xs" tone="muted">
									Placeholders: <span className="font-mono">{"{title}"}</span> e{" "}
									<span className="font-mono">{"{command}"}</span>.
								</Text>
								<Button
									type="button"
									onClick={() => save({ terminalTemplate: template.trim() })}
									disabled={saving || !template.trim() || template === settings.terminalTemplate}
									className="h-9 shrink-0"
								>
									Salvar
								</Button>
							</div>
						</section>

						<section className="space-y-2">
							<Title as="div" size="sm">
								Multiplexador
							</Title>
							<CustomSelect
								items={TERMINAL_MULTIPLEXERS.map((entry) => ({
									id: entry,
									label: TERMINAL_MULTIPLEXER_LABEL[entry],
								}))}
								value={settings.terminalMultiplexer}
								onValueChange={(value) =>
									save({ terminalMultiplexer: value as (typeof TERMINAL_MULTIPLEXERS)[number] })
								}
								renderItem={(item) => item.label}
								triggerClassName="h-9 w-full"
							/>
							<Text size="xs" tone="muted">
								tmux mantém as sessões vivas entre reinícios; kw-terminal usa workspaces
								persistentes do cliente kw-terminal (sem abrir emulador); nenhum abre uma janela
								nova a cada invocação.
							</Text>
						</section>

						<SourcePathsSection
							title="Fontes de agents"
							tools={AGENT_TOOLS}
							toolLabel={AGENT_TOOL_LABEL}
							defaultTool="claude-code"
							placeholder="Caminho absoluto da pasta de agents"
							help={
								<>
									Aponte para a pasta que contém os arquivos .md dos agents, como
									<span className="font-mono"> ~/.claude/agents</span>.
								</>
							}
							emptyText="Nenhuma fonte cadastrada."
							paths={agentPaths.paths}
							loading={agentPaths.loading}
							adding={agentPaths.adding}
							onAdd={agentPaths.addPath}
							onRemove={agentPaths.removePath}
						/>

						<SourcePathsSection
							title="Fontes de skills"
							tools={SKILL_TOOLS}
							toolLabel={SKILL_TOOL_LABEL}
							defaultTool="claude-code"
							placeholder="Caminho absoluto da pasta de skills"
							help={
								<>
									Aponte para a pasta que contém as subpastas das skills (cada uma com seu
									SKILL.md), como
									<span className="font-mono"> ~/.claude/skills</span>.
								</>
							}
							emptyText="Nenhuma fonte cadastrada."
							paths={skillPaths.paths}
							loading={skillPaths.loading}
							adding={skillPaths.adding}
							onAdd={skillPaths.addPath}
							onRemove={skillPaths.removePath}
						/>
					</>
				)}
			</div>
		</PageShell>
	);
}
