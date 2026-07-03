import { ChevronRight, Copy, Cpu, Gauge, Loader2, ShieldCheck, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { GroupLabel, MiniSelect } from "@/components/prompt-bar/controls";
import { usePromptExecution } from "@/components/prompt-bar/use-prompt-execution";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { Text } from "@/components/typography";
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
import { cn } from "@/lib/utils";
import { usePromptBarStore } from "@/stores/prompt-bar";

export function ExecutePanel({
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
	const patchClaudeSession = usePromptBarStore((s) => s.patchClaudeSession);
	const patchCodexSession = usePromptBarStore((s) => s.patchCodexSession);

	const { promptPreview, canExecute, isRunning, elapsedLabel, output, error, handleExecute } =
		usePromptExecution({ projectName, routePath, nextStage });

	return (
		<div className="mt-2 flex flex-col gap-2 border-t border-border pt-2">
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

				<Tooltip
					label={
						canExecute
							? "Executar o prompt no projeto sem abrir terminal"
							: "Escreva um prompt e abra uma rota com projeto"
					}
					triggerClassName="ml-auto inline-flex shrink-0"
				>
					<Button size="sm" disabled={!canExecute || isRunning} onClick={handleExecute}>
						{isRunning ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
						{isRunning ? `Executando (${elapsedLabel})` : "Executar"}
					</Button>
				</Tooltip>
			</div>

			<PromptPreview prompt={promptPreview} />

			{isRunning && (
				<div className="flex items-center gap-2 border border-border bg-muted/20 px-2 py-1.5">
					<Loader2 size={14} className="animate-spin text-muted-foreground" />
					<Text className="text-xs text-muted-foreground">
						Rodando headless no projeto… {elapsedLabel}
					</Text>
				</div>
			)}

			{output && (
				<div className="flex flex-col gap-1">
					<GroupLabel>Resultado</GroupLabel>
					<pre className="max-h-48 overflow-y-auto border border-border bg-muted/20 p-2 font-mono text-[11px] leading-5 text-foreground whitespace-pre-wrap break-all">
						{output}
					</pre>
				</div>
			)}

			{error && !isRunning && <Text className="text-xs text-destructive">{error}</Text>}
		</div>
	);
}

function PromptPreview({ prompt }: { prompt: string | null }) {
	const [expanded, setExpanded] = useState(false);

	async function handleCopy() {
		if (!prompt) {
			return;
		}
		const ok = await copyToClipboard(prompt);
		toast[ok ? "success" : "error"](ok ? "Copiado" : "Falha ao copiar");
	}

	return (
		<div className="flex items-start gap-2 border border-dashed border-border bg-muted/20 px-2 py-1">
			<button
				type="button"
				onClick={() => setExpanded((v) => !v)}
				disabled={!prompt}
				aria-label={expanded ? "Recolher prompt" : "Expandir prompt"}
				aria-expanded={expanded}
				className="shrink-0 text-muted-foreground/50 transition-colors hover:text-foreground disabled:cursor-default disabled:hover:text-muted-foreground/50"
			>
				<ChevronRight
					className={cn("h-3.5 w-3.5 transition-transform duration-150", expanded && "rotate-90")}
				/>
			</button>
			<span className="shrink-0 select-none font-mono text-[11px] leading-5 text-muted-foreground/50">
				›
			</span>
			<code
				className={cn(
					"min-w-0 flex-1 font-mono text-[11px] leading-5 text-muted-foreground",
					expanded ? "whitespace-pre-wrap break-all" : "truncate",
				)}
				title={prompt ?? ""}
			>
				{prompt ?? "marque rota/input ou escolha um agent/skill na Invocação"}
			</code>
			{prompt && (
				<Tooltip label="Copiar prompt">
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
