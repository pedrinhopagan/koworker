import { ChevronDown, SlidersHorizontal } from "lucide-react";

import { InvokeCliSelect } from "@/components/invoke-cli-select";
import { Text } from "@/components/typography";
import { CustomSelect } from "@/components/ui/custom-select";
import {
	CODEX_EFFORT_OPTIONS,
	CODEX_MODEL_OPTIONS,
	CODEX_APPROVAL_OPTIONS,
	type CodexApprovalMode,
	INVOKE_EFFORT_OPTIONS,
	INVOKE_MODEL_OPTIONS,
	INVOKE_PERMISSION_OPTIONS,
	type InvokePermissionMode,
	reflectValue,
} from "@/constants/invoke";
import { usePromptBarStore } from "@/stores/prompt-bar";

function toItems(options: { value: string; label: string; hint: string }[]) {
	return options.map((option) => ({ id: option.value, label: option.label, hint: option.hint }));
}

export function ExecutionSettings() {
	const cli = usePromptBarStore((state) => state.cli);
	const invoke = usePromptBarStore((state) => state.invoke);
	const patchClaudeSession = usePromptBarStore((state) => state.patchClaudeSession);
	const patchCodexSession = usePromptBarStore((state) => state.patchCodexSession);
	const session = cli === "codex" ? invoke.codex : invoke.claude;
	const modelOptions = toItems(
		reflectValue(cli === "codex" ? CODEX_MODEL_OPTIONS : INVOKE_MODEL_OPTIONS, session.model),
	);
	const effortOptions = toItems(
		reflectValue(cli === "codex" ? CODEX_EFFORT_OPTIONS : INVOKE_EFFORT_OPTIONS, session.effort),
	);
	const activeModel = modelOptions.find((option) => option.id === session.model);
	const activeEffort = effortOptions.find((option) => option.id === session.effort);
	const mode = cli === "codex" ? invoke.codex.approvalMode : invoke.claude.permissionMode;
	const modeOptions = toItems(cli === "codex" ? CODEX_APPROVAL_OPTIONS : INVOKE_PERMISSION_OPTIONS);
	const activeMode = modeOptions.find((option) => option.id === mode);

	return (
		<div className="mb-4 border border-border bg-muted/20 p-3">
			<div className="mb-3 flex items-center gap-2">
				<SlidersHorizontal className="size-4 text-muted-foreground" />
				<Text className="text-xs font-bold uppercase tracking-[0.12em]">Agente da execução</Text>
			</div>
			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<div className="min-w-0">
					<InvokeCliSelect />
				</div>
				<div className="min-w-0">
					<CustomSelect
						items={modelOptions}
						value={session.model}
						onValueChange={(model) =>
							cli === "codex" ? patchCodexSession({ model }) : patchClaudeSession({ model })
						}
						renderTrigger={() => (
							<>
								<span className="min-w-0 flex-1 truncate text-left">{activeModel?.label}</span>
								<ChevronDown className="size-4 shrink-0 opacity-50" />
							</>
						)}
						renderItem={(option) => (
							<div className="flex flex-col">
								<span>{option.label}</span>
								<span className="text-[11px] text-muted-foreground">{option.hint}</span>
							</div>
						)}
						upperLabel
						label="Modelo"
					/>
				</div>
				<div className="min-w-0">
					<CustomSelect
						items={effortOptions}
						value={session.effort}
						onValueChange={(effort) =>
							cli === "codex" ? patchCodexSession({ effort }) : patchClaudeSession({ effort })
						}
						renderTrigger={() => (
							<>
								<span className="min-w-0 flex-1 truncate text-left">{activeEffort?.label}</span>
								<ChevronDown className="size-4 shrink-0 opacity-50" />
							</>
						)}
						renderItem={(option) => (
							<div className="flex flex-col">
								<span>{option.label}</span>
								<span className="text-[11px] text-muted-foreground">{option.hint}</span>
							</div>
						)}
						upperLabel
						label="Esforço"
					/>
				</div>
				<div className="min-w-0">
					<CustomSelect
						items={modeOptions}
						value={mode}
						onValueChange={(value) =>
							cli === "codex"
								? patchCodexSession({ approvalMode: value as CodexApprovalMode })
								: patchClaudeSession({ permissionMode: value as InvokePermissionMode })
						}
						renderTrigger={() => (
							<>
								<span className="min-w-0 flex-1 truncate text-left">{activeMode?.label}</span>
								<ChevronDown className="size-4 shrink-0 opacity-50" />
							</>
						)}
						renderItem={(option) => (
							<div className="flex flex-col">
								<span>{option.label}</span>
								<span className="text-[11px] text-muted-foreground">{option.hint}</span>
							</div>
						)}
						upperLabel
						label={cli === "codex" ? "Aprovação" : "Permissão"}
					/>
				</div>
			</div>
		</div>
	);
}
