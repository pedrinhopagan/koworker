import { Bot, ChevronRight, Copy, Cpu, Gauge, Play, ShieldCheck, Sparkles, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { GroupLabel, MiniSelect, ToggleBox } from "@/components/prompt-bar/controls";
import { type Selection, useInvocation } from "@/components/prompt-bar/use-invocation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip } from "@/components/ui/tooltip";
import {
	CODEX_APPROVAL_OPTIONS,
	CODEX_EFFORT_OPTIONS,
	CODEX_MODEL_OPTIONS,
	type CodexApprovalMode,
	INVOKE_EFFORT_OPTIONS,
	INVOKE_MODEL_OPTIONS,
	INVOKE_PERMISSION_OPTIONS,
	type InvokePermissionMode,
} from "@/constants/invoke";
import type { TaskStage } from "@/constants/complexity";
import { copyToClipboard } from "@/lib/build-prompt";
import { LucideIcon } from "@/lib/lucide-icon";
import { cn } from "@/lib/utils";
import { usePromptBarStore } from "@/stores/prompt-bar";
import type { TaskAgent } from "@/types/agents";

// Estrutura mínima compartilhada por agent e skill — o que o picker precisa pra listar e filtrar.
type TargetEntry = {
	slug: string;
	label: string;
	description: string;
	icon: string;
	color: string;
};

function matches(
	entry: { slug: string; label: string; description: string },
	term: string,
): boolean {
	if (!term) {
		return true;
	}
	return (
		entry.slug.toLowerCase().includes(term) ||
		entry.label.toLowerCase().includes(term) ||
		entry.description.toLowerCase().includes(term)
	);
}

// Painel de invocação: revelado pelo trigger "Invocação". No topo o Alvo (Skills | Agent + chip);
// abaixo a Sessão do CLI ativo — Sessão claude (modelo/esforço/permissão) ou Sessão codex
// (modelo/esforço/aprovação) — junto das preferências de aba. Embaixo, o comando exato ao vivo. O
// botão Invocar mora na seção de ações do prompt-bar; os dois compartilham o mesmo estado via
// useInvocation.
export function InvokePanel({
	projectName,
	routePath,
	nextStage,
}: {
	projectName?: string;
	routePath: string | null;
	nextStage?: TaskStage | null;
}) {
	const cli = usePromptBarStore((s) => s.cli);
	const invoke = usePromptBarStore((s) => s.invoke);
	const patchInvoke = usePromptBarStore((s) => s.patchInvoke);
	const patchClaudeSession = usePromptBarStore((s) => s.patchClaudeSession);
	const patchCodexSession = usePromptBarStore((s) => s.patchCodexSession);

	const {
		selection,
		selectTarget,
		clearTarget,
		suggestedAgent,
		skillList,
		taskAgents,
		agentsLoading,
		skillsLoading,
		preview,
		canInvoke,
		handleInvoke,
	} = useInvocation({ projectName, routePath, nextStage });

	return (
		<div className="mt-2 flex flex-col gap-2 border-t border-border pt-2">
			{/* Alvo: Skills | Agent + chip do alvo/sugestão do fluxo. Agents são do claude. O Invocar
			    fica no fim da linha, à direita. */}
			<div className="flex flex-wrap items-center gap-2">
				<GroupLabel>Alvo</GroupLabel>
				<TargetMenu
					icon={Sparkles}
					label="Skills"
					items={skillList}
					loading={skillsLoading}
					empty="Nenhuma skill com invocação rápida — ligue em Aparência da skill"
					slash
					onSelect={(skill) => selectTarget({ kind: "skill", skill })}
				/>
				{cli === "claude" ? (
					<TargetMenu
						icon={Bot}
						label="Agent"
						items={taskAgents}
						loading={agentsLoading}
						empty="Nenhum agent encontrado"
						onSelect={(agent) => selectTarget({ kind: "agent", agent })}
					/>
				) : (
					<Tooltip label="Agents (--agent) são um recurso do claude">
						<span className="flex h-8 cursor-not-allowed items-center gap-1.5 border border-border bg-card px-2.5 text-sm text-muted-foreground opacity-40">
							<Bot className="h-3.5 w-3.5" />
							Agent
						</span>
					</Tooltip>
				)}
				{selection ? (
					<SelectedChip selection={selection} onClear={clearTarget} />
				) : suggestedAgent ? (
					<SuggestionChip
						agent={suggestedAgent}
						onSelect={() => selectTarget({ kind: "agent", agent: suggestedAgent })}
					/>
				) : null}

				<Tooltip
					label={
						canInvoke
							? "Invocar numa nova aba do terminal"
							: "Escolha um agent ou skill pra invocar"
					}
					triggerClassName="ml-auto inline-flex shrink-0"
				>
					<Button size="sm" disabled={!canInvoke} onClick={handleInvoke}>
						<Play size={14} />
						Invocar{selection ? ` ${selection.kind}` : ""}
					</Button>
				</Tooltip>
			</div>

			<div className="h-px bg-border" aria-hidden />

			{/* Sessão do CLI ativo: knobs próprios de cada um + preferências de aba do terminal. */}
			<div className="flex flex-wrap items-center gap-2">
				<GroupLabel>{cli === "codex" ? "Sessão codex" : "Sessão claude"}</GroupLabel>
				{cli === "codex" ? (
					<>
						<MiniSelect
							icon={Cpu}
							value={invoke.codex.model}
							onChange={(v) => patchCodexSession({ model: v })}
							options={CODEX_MODEL_OPTIONS}
						/>
						<MiniSelect
							icon={Gauge}
							value={invoke.codex.effort}
							onChange={(v) => patchCodexSession({ effort: v })}
							options={CODEX_EFFORT_OPTIONS}
						/>
						<MiniSelect
							icon={ShieldCheck}
							value={invoke.codex.approvalMode}
							onChange={(v) => patchCodexSession({ approvalMode: v as CodexApprovalMode })}
							options={CODEX_APPROVAL_OPTIONS}
						/>
					</>
				) : (
					<>
						<MiniSelect
							icon={Cpu}
							value={invoke.claude.model}
							onChange={(v) => patchClaudeSession({ model: v })}
							options={INVOKE_MODEL_OPTIONS}
						/>
						<MiniSelect
							icon={Gauge}
							value={invoke.claude.effort}
							onChange={(v) => patchClaudeSession({ effort: v })}
							options={INVOKE_EFFORT_OPTIONS}
						/>
						<MiniSelect
							icon={ShieldCheck}
							value={invoke.claude.permissionMode}
							onChange={(v) => patchClaudeSession({ permissionMode: v as InvokePermissionMode })}
							options={INVOKE_PERMISSION_OPTIONS}
						/>
					</>
				)}

				<div className="ml-auto flex items-center gap-2">
					<ToggleBox
						label="nova aba"
						hint="abre numa aba tmux nova em vez de reusar a do alvo"
						checked={invoke.forceNew}
						onChange={(v) => patchInvoke({ forceNew: v })}
					/>
					<ToggleBox
						label="background"
						hint="dispara sem trazer o terminal pra frente"
						checked={invoke.background}
						onChange={(v) => patchInvoke({ background: v })}
					/>
				</div>
			</div>

			<CommandPreview command={preview} hasTarget={!!selection} />
		</div>
	);
}

// Chip do alvo ativo: ícone na cor do agent/skill, label e um X pra limpar e escolher outro.
function SelectedChip({
	selection,
	onClear,
}: {
	selection: NonNullable<Selection>;
	onClear: () => void;
}) {
	const display = selection.kind === "agent" ? selection.agent : selection.skill;
	const Icon = selection.kind === "agent" ? Bot : Sparkles;
	return (
		<div
			className="flex h-8 items-center gap-1.5 border border-primary/40 bg-primary/5 pl-2 pr-1 text-sm"
			style={{ color: display.color }}
		>
			<Icon className="h-3.5 w-3.5 shrink-0" />
			<span className="max-w-32 truncate text-foreground">{display.label}</span>
			<Tooltip label="Limpar alvo">
				<button
					type="button"
					aria-label="Limpar alvo"
					onClick={onClear}
					className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
				>
					<X className="h-3.5 w-3.5" />
				</button>
			</Tooltip>
		</div>
	);
}

// Chip da invocação sugerida pelo fluxo: mesmo formato do SelectedChip, mas clicável inteiro pra
// pré-selecionar o agente do próximo passo. Só aparece sem alvo escolhido; escolher fixa a seleção.
function SuggestionChip({ agent, onSelect }: { agent: TaskAgent; onSelect: () => void }) {
	return (
		<Tooltip label={`Sugestão do fluxo: invocar ${agent.label}`}>
			<button
				type="button"
				onClick={onSelect}
				className="flex h-8 items-center gap-1.5 border border-dashed border-primary/40 bg-primary/5 px-2 text-sm transition-colors hover:bg-primary/10"
				style={{ color: agent.color }}
			>
				<Sparkles className="h-3.5 w-3.5 shrink-0" />
				<span className="max-w-32 truncate text-foreground">{agent.label}</span>
			</button>
		</Tooltip>
	);
}

// `command` com alvo é o comando exato do cli ativo; sem alvo é só o prompt que o "Copiar prompt"
// copia. Em ambos os casos é o reflexo ao vivo do que os toggles e knobs produzem.
function CommandPreview({ command, hasTarget }: { command: string | null; hasTarget: boolean }) {
	// Colapsado por default: o comando numa linha truncada. O chevron à esquerda expande pra ver o
	// texto inteiro quebrado em linhas.
	const [expanded, setExpanded] = useState(false);

	async function handleCopy() {
		if (!command) {
			return;
		}
		const ok = await copyToClipboard(command);
		toast[ok ? "success" : "error"](ok ? "Copiado" : "Falha ao copiar");
	}

	return (
		<div className="flex items-start gap-2 border border-dashed border-border bg-muted/20 px-2 py-1">
			<button
				type="button"
				onClick={() => setExpanded((v) => !v)}
				disabled={!command}
				aria-label={expanded ? "Recolher comando" : "Expandir comando"}
				aria-expanded={expanded}
				className="shrink-0 text-muted-foreground/50 transition-colors hover:text-foreground disabled:cursor-default disabled:hover:text-muted-foreground/50"
			>
				<ChevronRight
					className={cn("h-3.5 w-3.5 transition-transform duration-150", expanded && "rotate-90")}
				/>
			</button>
			<span className="shrink-0 select-none font-mono text-[11px] leading-5 text-muted-foreground/50">
				{hasTarget ? "$" : "›"}
			</span>
			<code
				className={cn(
					"min-w-0 flex-1 font-mono text-[11px] leading-5 text-muted-foreground",
					expanded ? "whitespace-pre-wrap break-all" : "truncate",
				)}
				title={command ?? ""}
			>
				{command ?? "marque rota/input ou escolha um agent ou skill"}
			</code>
			{command && (
				<Tooltip label={hasTarget ? "Copiar comando" : "Copiar prompt"}>
					<button
						type="button"
						aria-label="Copiar"
						onClick={() => void handleCopy()}
						className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
					>
						<Copy className="mt-0.5 h-3 w-3" />
					</button>
				</Tooltip>
			)}
		</div>
	);
}

// Botão-picker de alvo: abre um popover com busca e lista. Genérico sobre agent/skill — ambos têm
// slug/label/description/icon/color. Selecionar fecha e devolve o item inteiro ao chamador.
function TargetMenu<T extends TargetEntry>({
	icon: Icon,
	label,
	items,
	loading,
	empty,
	slash,
	onSelect,
}: {
	icon: typeof Bot;
	label: string;
	items: T[];
	loading: boolean;
	empty: string;
	slash?: boolean;
	onSelect: (item: T) => void;
}) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	const term = query.trim().toLowerCase();
	const list = items.filter((item) => matches(item, term));

	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) {
					setQuery("");
				}
			}}
		>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="flex h-8 items-center gap-1.5 border border-input bg-card px-2.5 text-sm text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground"
				>
					<Icon className="h-3.5 w-3.5" />
					{label}
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				side="top"
				className="w-72 p-0"
				onOpenAutoFocus={(event) => {
					event.preventDefault();
					inputRef.current?.focus();
				}}
			>
				<div className="border-b border-border p-2">
					<Input
						ref={inputRef}
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={`Buscar ${label.toLowerCase()}...`}
						className="h-8"
					/>
				</div>
				<div className="max-h-64 overflow-y-auto p-1">
					{list.length === 0 ? (
						<EmptyRow>{loading ? "Carregando..." : empty}</EmptyRow>
					) : (
						list.map((item) => (
							<TargetRow
								key={item.slug}
								entry={item}
								slash={slash}
								onSelect={() => {
									onSelect(item);
									setOpen(false);
								}}
							/>
						))
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}

function EmptyRow({ children }: { children: React.ReactNode }) {
	return <div className="px-2 py-1.5 text-xs text-muted-foreground">{children}</div>;
}

// Linha estrutural: agent e skill compartilham slug/label/description/icon/color, então uma só linha
// serve aos dois sem cast. `slash` prefixa `/` no slug das skills.
function TargetRow({
	entry,
	slash,
	onSelect,
}: {
	entry: TargetEntry;
	slash?: boolean;
	onSelect: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onSelect}
			className="flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors hover:bg-secondary/50"
		>
			<div
				className="flex h-6 w-6 shrink-0 items-center justify-center border bg-muted/30"
				style={{ borderColor: entry.color, color: entry.color }}
			>
				<LucideIcon name={entry.icon} className="size-3.5" />
			</div>
			<div className="min-w-0 flex-1">
				<div className="truncate text-sm text-foreground">
					{slash ? `/${entry.slug}` : entry.label}
				</div>
				<div className="truncate text-xs text-muted-foreground">{entry.description}</div>
			</div>
		</button>
	);
}
