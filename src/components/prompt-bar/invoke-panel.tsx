import { useQuery } from "@tanstack/react-query";
import { Bot, ChevronDown, Copy, Cpu, Gauge, Play, ShieldCheck, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { CustomSelect } from "@/components/ui/custom-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip } from "@/components/ui/tooltip";
import {
	INVOKE_EFFORT_OPTIONS,
	INVOKE_INHERIT,
	INVOKE_MODEL_OPTIONS,
	type InvokeOption,
	INVOKE_PERMISSION_OPTIONS,
	type InvokePermissionMode,
	reflectValue,
} from "@/constants/invoke";
import { useAgentsQuery } from "@/hooks/use-agents";
import { useSkillsQuery } from "@/hooks/use-skills";
import { buildKoworkerPrompt, copyToClipboard, flattenPrompt } from "@/lib/build-prompt";
import { type InvokeTarget, planInvocation, runInvocation } from "@/lib/invoke";
import { LucideIcon } from "@/lib/lucide-icon";
import { cn } from "@/lib/utils";
import { usePromptBarStore } from "@/stores/prompt-bar";
import type { TaskAgent } from "@/types/agents";
import type { TaskSkill } from "@/types/skills";

type Selection = { kind: "agent"; agent: TaskAgent } | { kind: "skill"; skill: TaskSkill } | null;

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

function toTarget(selection: NonNullable<Selection>): InvokeTarget {
	if (selection.kind === "agent") {
		return { kind: "agent", slug: selection.agent.slug, label: selection.agent.label };
	}
	return { kind: "skill", slug: selection.skill.slug, label: selection.skill.label };
}

// Padrão de model/effort que o alvo carrega no frontmatter. String não-vazia vira a pré-seleção do
// select; ausência cai em `INVOKE_INHERIT` ("padrão" = sem flag). Um ID de modelo completo passa
// reto — o select ganha um item extra pra refleti-lo.
function metaDefault(value: unknown): string {
	return typeof value === "string" && value.trim() ? value.trim() : INVOKE_INHERIT;
}

// Painel de invocação: vive abaixo da linha de ações do prompt-bar, revelado pelo botão robô. No topo
// o alvo (Skills | Agent) e o botão Invocar; abaixo os knobs que viajam junto (rota, input, sessão,
// modelo, esforço, permissão). Escolher um alvo pré-seleciona o model/effort padrão dele. Embaixo, o
// comando `claude` exato ao vivo.
export function InvokePanel({
	projectName,
	routePath,
}: {
	projectName?: string;
	routePath: string | null;
}) {
	const text = usePromptBarStore((s) => s.text);
	const interactWithRoute = usePromptBarStore((s) => s.interactWithRoute);
	const interactWithInput = usePromptBarStore((s) => s.interactWithInput);
	const invoke = usePromptBarStore((s) => s.invoke);
	const setInteractWithRoute = usePromptBarStore((s) => s.setInteractWithRoute);
	const setInteractWithInput = usePromptBarStore((s) => s.setInteractWithInput);
	const patchInvoke = usePromptBarStore((s) => s.patchInvoke);

	const projectsQuery = useQuery(orpc.projects.list.queryOptions());
	const { taskAgents, isLoading: agentsLoading } = useAgentsQuery();
	const { taskSkills, isLoading: skillsLoading } = useSkillsQuery(projectName);
	const [selection, setSelection] = useState<Selection>(null);

	// Skills são scoped por projeto: ao trocar o projeto em foco, a skill escolhida pode nem existir
	// mais. Zera o alvo (e os defaults que ele pré-selecionou) pra não invocar a definição errada.
	useEffect(() => {
		setSelection(null);
		patchInvoke({ model: INVOKE_INHERIT, effort: INVOKE_INHERIT });
	}, [projectName, patchInvoke]);

	// Só skills com invocação rápida entram na lista (mesmo critério do menu /).
	const skillList = useMemo(() => taskSkills.filter((skill) => skill.quickInvoke), [taskSkills]);

	const effectiveRoute = interactWithRoute ? routePath : null;
	const effectiveText = interactWithInput ? text : "";

	// Escolher um alvo fixa a seleção e puxa o model/effort padrão dele pros selects — é o que o
	// usuário vê e pode sobrescrever antes de invocar. Dono do default é o frontmatter do alvo; os
	// selects são só a janela editável disso, então model/effort não persistem (ver store).
	function selectTarget(next: NonNullable<Selection>) {
		setSelection(next);
		const metadata = next.kind === "agent" ? next.agent.metadata : next.skill.metadata;
		patchInvoke({ model: metaDefault(metadata.model), effort: metaDefault(metadata.effort) });
	}

	// Limpar o alvo solta também os defaults pré-selecionados: sem alvo, sem model/effort.
	function clearTarget() {
		setSelection(null);
		patchInvoke({ model: INVOKE_INHERIT, effort: INVOKE_INHERIT });
	}

	// Com alvo: o comando `claude` exato. Sem alvo: o prompt que "Copiar prompt" produz — assim os
	// checkboxes têm feedback visível mesmo antes de escolher agent/skill.
	const preview = useMemo(() => {
		if (selection) {
			return planInvocation({
				target: toTarget(selection),
				routePath: effectiveRoute,
				text: effectiveText,
				config: invoke,
			}).command;
		}
		const prompt = flattenPrompt(
			buildKoworkerPrompt({ target: effectiveRoute, text: effectiveText }),
		);
		return prompt || null;
	}, [selection, effectiveRoute, effectiveText, invoke]);

	function handleInvoke() {
		const project = projectsQuery.data?.find((p) => p.name === projectName);
		if (!project || !selection) {
			toast.error("Projeto da rota não encontrado");
			return;
		}
		runInvocation({
			project: { id: project.id, name: project.name, mainRoute: project.mainRoute },
			request: {
				target: toTarget(selection),
				routePath: effectiveRoute,
				text: effectiveText,
				config: invoke,
			},
		});
	}

	const canInvoke = !!projectName && !!selection;

	return (
		<div className="mt-2 flex flex-col gap-2 border-t border-border pt-2">
			{/* Topo: alvo (Skills | Agent) + Invocar. */}
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
				<TargetMenu
					icon={Bot}
					label="Agent"
					items={taskAgents}
					loading={agentsLoading}
					empty="Nenhum agent encontrado"
					onSelect={(agent) => selectTarget({ kind: "agent", agent })}
				/>
				{selection ? <SelectedChip selection={selection} onClear={clearTarget} /> : null}

				<div className="ml-auto">
					<Tooltip
						label={
							projectName ? "Invocar numa nova aba do terminal" : "Selecione um projeto em foco"
						}
						triggerClassName="inline-flex shrink-0"
					>
						<Button size="sm" disabled={!canInvoke} onClick={handleInvoke}>
							<Play size={14} />
							Invocar{selection ? ` ${selection.kind}` : ""}
						</Button>
					</Tooltip>
				</div>
			</div>

			<div className="h-px bg-border" aria-hidden />

			{/* Toggles: o que viaja junto com a invocação. Anexar (rota/input) e Sessão (aba/background)
			    em blocos próprios, cada um com seu rótulo. */}
			<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
				<ToggleGroup label="Anexar">
					<ToggleBox
						label="rota"
						hint={routePath ? `/kw ${routePath}` : "esta rota não anexa caminho"}
						checked={interactWithRoute}
						disabled={!routePath}
						onChange={setInteractWithRoute}
					/>
					<ToggleBox
						label="input"
						hint="anexa o texto digitado ao prompt"
						checked={interactWithInput}
						onChange={setInteractWithInput}
					/>
				</ToggleGroup>

				<div className="h-5 w-px bg-border" aria-hidden />

				<ToggleGroup label="Sessão">
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
				</ToggleGroup>
			</div>

			{/* Selects da sessão claude juntos: modelo, esforço e permissão. */}
			<div className="flex flex-wrap items-center gap-2">
				<GroupLabel>Sessão claude</GroupLabel>
				<MiniSelect
					icon={Cpu}
					value={invoke.model}
					onChange={(v) => patchInvoke({ model: v })}
					options={INVOKE_MODEL_OPTIONS}
				/>
				<MiniSelect
					icon={Gauge}
					value={invoke.effort}
					onChange={(v) => patchInvoke({ effort: v })}
					options={INVOKE_EFFORT_OPTIONS}
				/>
				<MiniSelect
					icon={ShieldCheck}
					value={invoke.permissionMode}
					onChange={(v) => patchInvoke({ permissionMode: v as InvokePermissionMode })}
					options={INVOKE_PERMISSION_OPTIONS}
				/>
			</div>

			<CommandPreview command={preview} hasTarget={!!selection} />
		</div>
	);
}

function GroupLabel({ children }: { children: React.ReactNode }) {
	return (
		<span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/60">
			{children}
		</span>
	);
}

function ToggleGroup({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex items-center gap-2">
			<GroupLabel>{label}</GroupLabel>
			{children}
		</div>
	);
}

function ToggleBox({
	label,
	hint,
	checked,
	disabled,
	onChange,
}: {
	label: string;
	hint: string;
	checked: boolean;
	disabled?: boolean;
	onChange: (value: boolean) => void;
}) {
	return (
		<Tooltip label={hint}>
			<label
				className={cn(
					"flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-muted-foreground",
					disabled && "cursor-not-allowed opacity-40",
				)}
			>
				<Checkbox
					size="sm"
					checked={checked}
					disabled={disabled}
					onCheckedChange={(value) => onChange(value === true)}
				/>
				{label}
			</label>
		</Tooltip>
	);
}

function MiniSelect({
	icon: Icon,
	value,
	onChange,
	options,
}: {
	icon: typeof Cpu;
	value: string;
	onChange: (value: string) => void;
	options: InvokeOption[];
}) {
	const items = reflectValue(options, value).map((option) => ({
		id: option.value,
		label: option.label,
		hint: option.hint,
	}));
	const active = items.find((option) => option.id === value);

	return (
		<Tooltip label={active?.hint ?? ""}>
			<CustomSelect
				items={items}
				value={value}
				onValueChange={(next) => onChange(next)}
				size="sm"
				fitContent
				triggerClassName="gap-1.5 px-2"
				renderTrigger={() => (
					<>
						<Icon className="size-3.5 shrink-0 text-muted-foreground" />
						<span className="truncate text-left text-xs">{active?.label ?? ""}</span>
						<ChevronDown className="size-3.5 shrink-0 opacity-50" />
					</>
				)}
				renderItem={(option) => <span className="text-xs">{option.label}</span>}
			/>
		</Tooltip>
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

// `command` com alvo é o comando `claude` exato; sem alvo é só o prompt que o "Copiar prompt" copia.
// Em ambos os casos é o reflexo ao vivo do que rota/input/modelo/esforço/permissão produzem.
function CommandPreview({ command, hasTarget }: { command: string | null; hasTarget: boolean }) {
	async function handleCopy() {
		if (!command) {
			return;
		}
		const ok = await copyToClipboard(command);
		toast[ok ? "success" : "error"](ok ? "Copiado" : "Falha ao copiar");
	}

	return (
		<div className="flex items-center gap-2 border border-dashed border-border bg-muted/20 px-2 py-1">
			<span className="shrink-0 select-none font-mono text-[11px] text-muted-foreground/50">
				{hasTarget ? "$" : "›"}
			</span>
			<code
				className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground"
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
						<Copy className="h-3 w-3" />
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
